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

// 撈出pid底下所有評論
// router.post("/one/:pid", async (req, res) => {
//     const pid = req.params.pid
//     const page = req.body.page || 1  // 這邊拿前端傳來的 page 頁數（預設第1頁）
//     const pageSize = 3               // 每頁固定抓3筆

//     const offset = (page - 1) * pageSize
//     const [rows] = await db.query(
//         `SELECT comments.*, profile.account, profile.photo FROM comments LEFT JOIN profile ON comments.sid = profile.sid WHERE comments.pid = ${pid} ORDER BY created_date DESC;`);
//         if (rows.length) return res.json(rows); // 直接回傳所有資料
//     else return res.json({});
// });

router.post("/one/:pid", async (req, res) => {
    const pid = req.params.pid
    const page = req.body.page || 1  // 這邊拿前端傳來的 page 頁數（預設第1頁）
    const pageSize = 3               // 每頁固定抓3筆

    const offset = (page - 1) * pageSize

    try {
        const [rows] = await db.query(
            `SELECT comments.*, profile.account, profile.photo
            FROM comments
            LEFT JOIN profile ON comments.sid = profile.sid
            WHERE comments.pid = ?
            ORDER BY created_date DESC
            LIMIT ? OFFSET ?`,
            [pid, pageSize, offset]
        );

        if (rows.length) return res.json(rows)
        else return res.json([])
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: '資料庫錯誤' })
    }
});
export default router;

router.post("/add", async (req, res) => {
    const output = {
        success: false,
        postDate: req.body,
    };

    const {
        comments_id,
        pid,
        sid,
        content,
        rating,
        created_date,
    } = req.body

    if (!pid || !sid || !content) {
        return res.status(400).json({
            success: false,
            message: "必填欄位為空"
        })
    }

    // 檢查是否有購買過該商品
    const [checkRows] = await db.query(
        `SELECT COUNT(*) AS count
        FROM order_list o
        JOIN order_child oi ON o.oid = oi.oid
        WHERE o.sid = ? AND oi.pid = ?`,
        [sid, pid]
    );

    if (checkRows[0].count) {
        return res.status(400).json({
            success: false,
            message: "尚未購買此商品，無法評論"
        })
    }

    const sql =
        "INSERT INTO `comments`(`comments_id`, `pid`, `sid`, `content`, `rating`, `created_date`) VALUES (?, ?, ?, ?, ?, NOW())";
    const [result] = await db.query(sql, [
        comments_id,
        pid,
        sid,
        content,
        rating,
        created_date,
    ])

    output.success = !!result.affectedRows;
    return res.json(output)

});
