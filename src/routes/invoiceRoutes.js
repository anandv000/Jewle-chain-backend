const express = require("express");
const router  = express.Router();
const {
  getAll, getById, create, update, remove,
  updateStatus, previewFromOrders,
} = require("../controllers/invoiceController");
const { protect } = require("../middleware/auth");

router.use(protect);

router.get("/",                    getAll);
router.get("/:id",                 getById);
router.post("/",                   create);
router.post("/preview-from-orders", previewFromOrders);
router.put("/:id",                 update);
router.patch("/:id/status",        updateStatus);
router.delete("/:id",              remove);

module.exports = router;
