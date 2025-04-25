import express from "express";
import db from "./../utils/connect-mysql.js";

const router = express.Router();

// ALL
router.post("/", async (req, res) => {
    const [rows, fields] = await db.query(
        `SELECT * FROM comments;`
    );
    if (rows.length) return res.json(rows);
    else return res.json({});
});


// 先撈出pid底下所有評論
router.post("/:pid", async (req, res) => {
    let pid = req.body.pid;
    const [rows] = await db.query(
        `SELECT * FROM comments WHERE pid=${pid}`);
    if (rows.length) return res.json(rows); // 直接回傳所有資料
    else return res.json({});
});

export default router;
