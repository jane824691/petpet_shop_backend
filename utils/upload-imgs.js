import multer from "multer";
import { v4 as uuidv4 } from "uuid"; //as更改名稱

const extMap = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

//!!轉成boolean,cb=callback function, (null, ?)由第二個屬性決定要不要拿值，如果有對應到附檔名就拿到true
const fileFilter = (req, file, cb) => {
  cb(null, !!extMap[file.mimetype]);
};

const storage = multer.memoryStorage();

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "public/img");
//   },
//   filename: (req, file, cb) => {
//     const main = uuidv4();
//     const ext = extMap[file.mimetype]; //副檔名
//     cb(null, main + ext);
//   },
// });

export default multer({ fileFilter, storage });