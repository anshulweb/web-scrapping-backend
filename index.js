const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const bodyParser = require('body-parser');
const cors = require('cors');
const Company = require('./models/Company');
const dotenv = require('dotenv');
const xlsx = require('xlsx');

const app = express();

app.use(bodyParser.json());
app.use(cors());
dotenv.config();
mongoose.connect(process.env.MONGODB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
  console.log('Connected to MongoDB');
});

app.post('/scrape', async (req, res) => {
  const { url, userId } = req.body;
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const name =
      $('meta[property="og:site_name"]').attr('content') || $('title').text();
    const description = $('meta[name="description"]').attr('content');
    const logo =
      $('link[rel="icon"]').attr('href') ||
      $('meta[property="og:image"]').attr('content');
    const facebook = $('a[href*="facebook.com"]').attr('href');
    const linkedin = $('a[href*="linkedin.com"]').attr('href');
    const twitter = $('a[href*="twitter.com"]').attr('href');
    const instagram = $('a[href*="instagram.com"]').attr('href');
    const address = $('address').text();
    const phone = $('a[href^="tel:"]').text();
    const email = $('a[href^="mailto:"]').text();

    const company = new Company({
      name,
      description,
      logo,
      facebook,
      linkedin,
      twitter,
      instagram,
      address,
      phone,
      email,
      userId,
    });

    await company.save();

    // Screenshot
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);
    const screenshot = `screenshots/${company._id}.png`;
    await page.screenshot({ path: screenshot });
    await browser.close();

    company.screenshot = screenshot;
    await company.save();

    res.json(company);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error scraping the website');
  }
});
app.get('/companies/:id', async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).send('Company not found');
    }
    res.json(company);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching the company details');
  }
});

app.use('/screenshots', express.static('screenshots'));
app.get('/companies', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    const companies = await Company.find();
    res.json(companies);
  } else {
    const companies = await Company.find({ userId });
    res.json(companies);
  }
});

app.delete('/companies', async (req, res) => {
  const { ids } = req.body;
  await Company.deleteMany({ _id: { $in: ids } });
  res.sendStatus(200);
});

app.post('/download', async (req, res) => {
  try {
    const { ids } = req.body;

    const companies = await Company.find({ _id: { $in: ids } });
    const data = companies.map((company) => ({
      Name: company.name,
      Description: company.description,
      Logo: company.logo,
      Facebook: company.facebook,
      LinkedIn: company.linkedin,
      Twitter: company.twitter,
      Instagram: company.instagram,
      Address: company.address,
      Phone: company.phone,
      Email: company.email,
    }));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data);

    xlsx.utils.book_append_sheet(wb, ws, 'Companies');

    const buffer = xlsx.write(wb, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="companies.xlsx"'
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.send(buffer);
  } catch (error) {
    console.error('Error generating Excel file:', error);
    res.status(500).send('Error generating Excel file');
  }
});

app.listen(5000, () => {
  console.log('Server is running on port 5000');
});
