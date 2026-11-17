export async function connect(config, onAccount) {
  const root = 'https://www.gstatic.com/firebasejs/11.10.0/firebase-';
  const [appApi, authApi, db, files] = await Promise.all(
    ['app','auth','firestore','storage'].map(name => import(root + name + '.js'))
  );
  const app = appApi.initializeApp(config);
  const auth = authApi.getAuth(app);
  const firestore = db.getFirestore(app);
  const storage = files.getStorage(app);
  await authApi.setPersistence(auth, authApi.browserLocalPersistence);
  authApi.onAuthStateChanged(auth, account => onAccount(account && makeStore(account.uid)));
  function makeStore(uid) {
    const doc = (kind, key) => db.doc(firestore, 'bopomofoTone', uid, kind, key);
    const collection = kind => db.collection(firestore, 'bopomofoTone', uid, kind);
    const file = key => files.ref(storage, 'bopomofo-tone/' + uid + '/audio/' + key);
    return {
      async catalog() { return (await db.getDoc(doc('settings','catalog'))).data()?.entries || []; },
      setCatalog(entries) { return db.setDoc(doc('settings','catalog'), { entries }); },
      async metadata() {
        return Object.fromEntries((await db.getDocs(collection('recordings'))).docs.map(row => [row.id, row.data()]));
      },
      audio(key) { return files.getBlob(file(key), 400000); },
      async saveAudio(id, role, key, blob) {
        await files.uploadBytes(file(key), blob, { contentType: 'audio/wav' });
        const target = doc('recordings', id);
        const previous = await db.runTransaction(firestore, async tx => {
          const row = (await tx.get(target)).data();
          tx.set(target, { id, [role]: { key, status: role === 'mother' ? 'ready' : 'pending' } }, { merge: true });
          return row?.[role]?.key;
        });
        if (previous) void files.deleteObject(file(previous)).catch(() => {});
      },
      review(id, key, status) {
        const target = doc('recordings', id);
        return db.runTransaction(firestore, async tx => {
          if ((await tx.get(target)).data()?.brother?.key !== key) throw Error('錄音已更新，請重新開啟教材。');
          tx.update(target, { 'brother.status': status });
        });
      },
      saveAnswer(row) { return db.setDoc(doc('answers',row.id), row); },
      async answers() { return (await db.getDocs(collection('answers'))).docs.map(row => row.data()); }
    };
  }
  return {
    signIn(email, password) { return authApi.signInWithEmailAndPassword(auth,email,password); },
    signOut() { return authApi.signOut(auth); }
  };
}
