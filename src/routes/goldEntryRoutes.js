const express = require("express");
const router  = express.Router();
const {
  getByCustomer, getById, createEntry, downloadPdf, deleteEntry
} = require("../controllers/goldEntryController");

router.get("/customer/:customerId", getByCustomer);
router.get("/:id/pdf",             downloadPdf);
router.get("/:id",                 getById);
router.post("/",                   createEntry);
router.delete("/:id",              deleteEntry);

module.exports = router;
