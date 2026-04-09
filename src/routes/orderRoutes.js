const express = require("express");
const router  = express.Router();
const {
  getAllOrders, getOrderById, createOrder,
  updateStep, deleteOrder,
  getWastageReport, saveBillingData,
  getOwnerInfo,
} = require("../controllers/orderController");

router.get("/wastage", getWastageReport);
router.get("/owner",   getOwnerInfo);          // GET owner (Lariot Jweles)
router.route("/").get(getAllOrders).post(createOrder);
router.route("/:id").get(getOrderById).delete(deleteOrder);
router.patch("/:id/step",    updateStep);
router.patch("/:id/billing", saveBillingData);

module.exports = router;
