const express = require("express");
const router  = express.Router();
const upload  = require("../middleware/upload");
const {
  getAllFolders,
  createFolder,
  deleteFolder,
  addItem,
  removeItem,
} = require("../controllers/folderController");

// No protect middleware — open routes
router.route("/").get(getAllFolders).post(createFolder);
router.route("/:id").delete(deleteFolder);
router.post("/:id/items", upload.single("image"), addItem);
router.delete("/:folderId/items/:itemId", removeItem);

module.exports = router;
