const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const ALL_PERMISSIONS = [
  "dashboard","admin-stock","customers","products",
  "diamonds","create-order","bag","wastage","ledger","bag-status",
];

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, trim: true, lowercase: true },
    phone:    { type: String, default: "" },
    password: { type: String, required: true, minlength: 6 },

    // host → platform owner | admin → business owner | sub-admin/hr/employee → team
    role: {
      type: String,
      enum: ["host", "admin", "sub-admin", "hr", "employee"],
      default: "admin",
    },

    // Which sidebar pages this user can access
    permissions: { type: [String], default: ALL_PERMISSIONS },

    isActive:   { type: Boolean, default: true  },
    isVerified: { type: Boolean, default: false },

    // admin's _id that this user belongs to (null for host/admin)
    workspace:  { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    otp:        { type: String, default: null },
    otpExpiry:  { type: Date,   default: null },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = async function (p) {
  return bcrypt.compare(p, this.password);
};

userSchema.statics.ALL_PERMISSIONS = ALL_PERMISSIONS;

module.exports = mongoose.model("User", userSchema);
