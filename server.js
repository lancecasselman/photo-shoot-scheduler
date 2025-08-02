const express = require('express');
const app = express();
const path = require('path');

// Import Firebase Admin from the centralized module
const { admin, db } = require('./server/firebase-admin.js');

app.use(express.json());
app.use('/js', express.static(path.join(__dirname, 'src/js')));
app.use('/css', express.static(path.join(__dirname, 'src/css')));

app.get('/website-builder.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'website-builder.html'));
});

app.post('/api/save-layout', async (req, res) => {
  const { layout } = req.body;
  try {
    const docRef = await db.collection('builderPages').add({
      layout,
      createdAt: new Date()
    });
    res.json({ success: true, message: 'Layout saved', id: docRef.id });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ success: false, message: 'Save failed' });
  }
});

app.get('/api/load-layout/:id', async (req, res) => {
  try {
    const doc = await db.collection('builderPages').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Layout not found' });
    }
    res.json(doc.data());
  } catch (error) {
    console.error('Load error:', error);
    res.status(500).json({ success: false, message: 'Load failed' });
  }
});


app.get('/api/layouts', async (req, res) => {
  try {
    const snapshot = await db.collection('builderPages').orderBy('createdAt', 'desc').limit(10).get();
    const layouts = snapshot.docs.map(doc => ({ id: doc.id, createdAt: doc.data().createdAt.toDate().toISOString() }));
    res.json(layouts);
  } catch (error) {
    res.status(500).json({ message: 'Failed to load layouts' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});