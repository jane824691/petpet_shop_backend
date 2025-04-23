import express from "express";
import db from "./../utils/connect-mysql.js";

const router = express.Router();

// TODO:先做撈出pid底下所有評論 > 接著add評論 
router.post("/comments/:pid", async (req, res) => {
    const [rows] = await db.query(
        "SELECT * FROM pet_shop.order_list o JOIN pet_shop.order_child oi ON o.oid = oi.oid WHERE oi.pid = 193");
    console.log('recommend data:', rows);
    if (rows.length) return res.json(rows); // 直接回傳所有資料
    else return res.json({});
});

export default router;
