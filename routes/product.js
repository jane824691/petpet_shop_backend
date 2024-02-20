import express from "express";
import db from "../utils/connect-mysql.js";
import upload from "../utils/upload-imgs.js";
import dayjs from "dayjs";

const router = express.Router();

router.use((req, res, next) => {
  const u = req.url.split("?")[0]; // 只要路徑
  console.log({ u });
  if (req.method === "GET" && u === "/") {
    return next();
  }
  /*
  if (!req.session.admin) {
    return res.redirect("/login");
  } */
  next();
});

// 總頁面的所有資訊
const getListData = async (req) => {
  const perPage = 12; // 每頁幾筆
  let page = +req.query.page || 1; // 用戶決定要看第幾頁
  let searchWord =
    req.query.searchWord && typeof req.query.searchWord === "string"
      ? req.query.searchWord.trim()
      : "";
  let searchWord_ = db.escape(`%${searchWord}%`);

  let qs = {}; // 用來把 query string 的設定傳給 template
  let priceHigh = req.query.priceHigh ? req.query.priceHigh.trim() : ""; // 價錢區間高
  let priceLow = req.query.priceLow ? req.query.priceLow.trim() : ""; // 價錢區間低
  // let priceCheap = req.query.priceCheap ? req.query.priceCheap.trim() : ""; //價錢排序從便宜
  // let priceExpensive = req.query.priceExpensive ? req.query.priceExpensive.trim() : ""; //價錢排序從貴
  let sortBy = req.query.sortBy ? req.query.sortBy.trim() : ""; //價格排序方式


  // 查關鍵字對應api
  let where = ` WHERE 1 `;
  if (searchWord) {
    qs.searchWord = searchWord;
    where += ` AND ( \`product_name\` LIKE ${searchWord_} OR \`product_description\` LIKE ${searchWord_} ) `;
  }
  if (priceLow) {
    qs.priceLow = priceLow;
    where += ` AND product_price >= '${priceLow}' `;
  }
  if (priceHigh) {
    qs.priceHigh = priceHigh;
    where += ` AND product_price <= '${priceHigh}' `;
  }
  // if (priceCheap) {
  //   qs.priceCheap = priceCheap;
  //   where += ` AND product_price >= '${priceCheap}' `;
  // }
  // if (priceExpensive) {
  //   qs.priceExpensive = priceExpensive;
  //   where += ` AND product_price <= '${priceExpensive}' `;
  // }


  // 構建價格排序子句
  let sortByClause = "";
  if (sortBy === "cheap") {
    sortByClause = "ORDER BY product_price ASC";
  } else if (sortBy === "expensive") {
    sortByClause = "ORDER BY product_price DESC";
  }

  let totalRows = 0;
  let totalPages = 0;
  let rows = [];

  let output = {
    success: false,
    page,
    perPage,
    rows,
    totalRows,
    totalPages,
    qs,
    redirect: "",
    info: "",
  };

  if (page < 1) {
    output.redirect = `?page=1`;
    output.info = `頁碼值小於 1`;
    return output;
  }

  const t_sql = `SELECT COUNT(1) totalRows FROM product ${where}`;
  [[{ totalRows }]] = await db.query(t_sql);
  totalPages = Math.ceil(totalRows / perPage);
  if (totalRows > 0) {
    if (page > totalPages) {
      output.redirect = `?page=${totalPages}`;
      output.info = `頁碼值大於總頁數`;
      return { ...output, totalRows, totalPages };
    }

    // 根據是否有價格排序來決定 SQL 查詢中的排序方式
    let priceSortClause = sortByClause ? sortByClause : "ORDER BY pid DESC";

    const sql = `SELECT * FROM product ${where} ${priceSortClause} 
    LIMIT ${(page - 1) * perPage}, ${perPage}`;
    [rows] = await db.query(sql);
    output = { ...output, success: true, rows, totalRows, totalPages };
  }

  return output;
};


router.get("/api", async (req, res) => {
  res.json(await getListData(req));
  /*
  if(res.locals.jwt?.id){
    return res.json(await getListData(req));
  } else {
    return res.json({success: false, error: "沒有授權, 不能取得資料"});
  }
  */
});


router.get("/one/:pid", async (req, res) => {
  let pid = +req.params.pid || 1;
  const [rows, fields] = await db.query(
    `SELECT DISTINCT product.*, product_mutiple_img.photo_content_main, product_mutiple_img.photo_content_secondary, product_mutiple_img.photo_content FROM product LEFT JOIN product_mutiple_img ON product.pid = product_mutiple_img.pid WHERE product.pid = ${pid};`
  );
  if (rows.length) return res.json(rows[0]);
  else return res.json({});
});

export default router;