const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: String,
  description: String,
  logo: String,
  facebook: String,
  linkedin: String,
  twitter: String,
  instagram: String,
  address: String,
  phone: String,
  email: String,
  screenshot: String,
  userId: String,
});

module.exports = mongoose.model('Company', companySchema);
