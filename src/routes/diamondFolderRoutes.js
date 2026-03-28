const express = require("express");
const router  = express.Router();
const {
  getAllFolders, createFolder, deleteFolder,
  addDiamond, updateDiamond, removeDiamond,
} = require("../controllers/diamondFolderController");

router.route("/").get(getAllFolders).post(createFolder);
router.route("/:id").delete(deleteFolder);
router.route("/:id/diamonds").post(addDiamond);
router.route("/:id/diamonds/:diamondId").put(updateDiamond).delete(removeDiamond);

module.exports = router;
