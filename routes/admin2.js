import express from "express";

const router = express.Router();

router.get("/admin2/:p1?/:p2?", (req, res) => {
  const {
    url,
    baseUrl,
    originalUrl,
    params: { p1, p2 }, //params解構成p1,p2
  } = req;

  res.json({
    url,
    baseUrl,
    originalUrl,
    p1,
    p2,
  });
});

export default router;
