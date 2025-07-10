import express from "express";
import db from "../utils/connect-mysql.js";
import { languageMiddleware } from "../utils/i18n.js";
import { localizeProducts, localizeProduct, buildSearchCondition } from "../utils/product-i18n.js";

const router = express.Router();

// 使用語言中間件
router.use(languageMiddleware);

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

  let qs = {}; // 用來把 query string 的設定傳給 template
  let priceHigh = req.query.priceHigh ? req.query.priceHigh.trim() : ""; // 價錢區間高
  let priceLow = req.query.priceLow ? req.query.priceLow.trim() : ""; // 價錢區間低
  let sortBy = req.query.sortBy ? req.query.sortBy.trim() : ""; // 價格排序方式
  let tag = req.query.tag ? req.query.tag.trim() : ""; // 價格排序方式

  // 查關鍵字對應api - 支援中英文搜尋
  let where = ` WHERE 1 `;
  if (searchWord) {
    qs.searchWord = searchWord;
    where += buildSearchCondition(searchWord);
  }
  // 查價格區間
  if (priceLow) {
    qs.priceLow = priceLow;
    where += ` AND product_price >= '${priceLow}' `;
  }
  if (priceHigh) {
    qs.priceHigh = priceHigh;
    where += ` AND product_price <= '${priceHigh}' `;
  }
  // 查tag對應
  if (tag) {
    qs.tag = tag;
    // 將複數的 tag 轉換為陣列
    const tagArray = tag.split(",").map((item) => parseInt(item.trim()));
    // 使用 IN 運算符檢查 category_id 是否在 tagArray 中
    where += ` AND \`category_id\` IN (${tagArray.join(",")})`;
  }

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
    output.info = req.t('errors.invalidPage');
    return output;
  }

  const t_sql = `SELECT COUNT(1) totalRows FROM product ${where}`;
  [[{ totalRows }]] = await db.query(t_sql);
  totalPages = Math.ceil(totalRows / perPage);
  if (totalRows > 0) {
    if (page > totalPages) {
      output.redirect = `?page=${totalPages}`;
      output.info = req.t('errors.pageExceeded');
      return { ...output, totalRows, totalPages };
    }

    // 根據是否有價格排序來決定 SQL 查詢中的排序方式
    let priceSortClause = sortByClause ? sortByClause : "ORDER BY pid DESC";

    const sql = `SELECT * FROM product ${where} ${priceSortClause} 
    LIMIT ${(page - 1) * perPage}, ${perPage}`;
    [rows] = await db.query(sql);
    
    // 對商品資料進行雙語處理
    const localizedRows = localizeProducts(rows);
    
    output = { ...output, success: true, rows: localizedRows, totalRows, totalPages };
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
  
  if (rows.length) {
    const localizedProduct = localizeProduct(rows[0]);
    return res.json(localizedProduct);
  } else {
    return res.json({});
  }
});


router.get("/recommend", async (req, res) => {
  const [rows] = await db.query(
    "SELECT * FROM product WHERE sales_condition != '已下架' ORDER BY RAND() LIMIT 4");

  if (rows.length) {
    const localizedRows = localizeProducts(rows);
    return res.json(localizedRows);
  } else {
    return res.json({});
  }
});


// 測試雙語功能的端點
router.get("/test-i18n", async (req, res) => {
  // 測試翻譯功能
  const testData = {
    translations: {
      error: req.t('errors.unauthorized'),
      status: req.t('status.success'),
      productName: req.t('product.name'),
      sortCheap: req.t('filters.sortBy.cheap')
    },
    sampleProduct: {
      pid: 1,
      product_name: "測試商品",
      product_name_en: "Test Product",
      product_description: "這是測試商品描述",
      product_description_en: "This is a test product description",
      sales_condition: "可購買"
    }
  };
  
  // 對範例商品進行雙語處理
  testData.localizedProduct = localizeProduct(testData.sampleProduct);
  
  res.json(testData);
});

export default router;
