// server.js

import express from 'express';
import cors from 'cors';
import { pool } from './db.js';

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());


app.get('/pengeluaran', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.judul, p.nominal, p.tanggal,
              k.nama AS kategori
       FROM pengeluaran p
       LEFT JOIN kategori k ON p.id_kategori = k.id
        ORDER BY p.id DESC`
    );

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({
      pesan: 'Gagal mengambil data'
    });
  }
});

app.get('/pengeluaran/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.judul, p.nominal, p.tanggal,
              k.nama AS kategori
       FROM pengeluaran p
       LEFT JOIN kategori k ON p.id_kategori = k.id
       WHERE p.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        pesan: 'Data tidak ditemukan'
      });
    }

    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({
      pesan: 'Gagal mengambil data'
    });
  }
});

app.post('/pengeluaran', async (req, res) => {
  const { judul, nominal, id_kategori } = req.body;

  if (!judul || !nominal) {
    return res.status(400).json({
      pesan: 'judul & nominal wajib'
    });
  }

  try {
    const [hasil] = await pool.query(
      `INSERT INTO pengeluaran (judul, nominal, id_kategori)
       VALUES (?, ?, ?)`,
      [
        judul,
        Number(nominal),
        id_kategori ?? null
      ]
    );

    res.status(201).json({
      message: 'Data berhasil ditambahkan',
      id: hasil.insertId
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      pesan: 'Gagal menyimpan data'
    });
  }
});


app.put('/pengeluaran/:id', async (req, res) => {
  const { judul, nominal, id_kategori } = req.body;

  try {
    const [hasil] = await pool.query(
      `UPDATE pengeluaran
       SET judul = ?, nominal = ?, id_kategori = ?
       WHERE id = ?`,
      [
        judul,
        Number(nominal),
        id_kategori ?? null,
        req.params.id
      ]
    );

    if (hasil.affectedRows === 0) {
      return res.status(404).json({
        pesan: 'Data tidak ditemukan'
      });
    }

    res.json({
      message: 'Data berhasil diubah'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      pesan: 'Gagal mengubah data'
    });
  }
});


app.delete('/pengeluaran/:id', async (req, res) => {
  try {
    const [hasil] = await pool.query(
      'DELETE FROM pengeluaran WHERE id = ?',
      [req.params.id]
    );

    if (hasil.affectedRows === 0) {
      return res.status(404).json({
        pesan: 'Data tidak ditemukan'
      });
    }

    res.status(204).end();

  } catch (e) {
    console.error(e);
    res.status(500).json({
      pesan: 'Gagal menghapus data'
    });
  }
});

app.get('/kategori', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nama FROM kategori ORDER BY id DESC'
    );

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({
      pesan: 'Gagal mengambil kategori'
    });
  }
});


app.get('/kategori/ringkasan', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
          k.nama AS kategori,
          COUNT(p.id) AS jumlah_transaksi,
          COALESCE(SUM(p.nominal), 0) AS total
       FROM kategori k
       LEFT JOIN pengeluaran p
         ON p.id_kategori = k.id
       GROUP BY k.id, k.nama
       ORDER BY k.id DESC`
    );

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({
      pesan: 'Gagal mengambil ringkasan kategori'
    });
  }
});

const PORT = 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server berjalan di http://0.0.0.0:${PORT}`);
});