const express = require('express');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(express.json()); // lets us read JSON from request body

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Temporary storage for OTPs (email -> otp)
const otpStore = {};

// Generates a random 6-digit number as a string
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

let counter = 0;
function idGenerator() {
  counter = counter + 1;
  let year = new Date().getFullYear();
  let id = "HACK-" + year + "-" + counter;
  return id;
}
let submissions = []; // stores past submissions to check for duplicates
// Existing email-sending endpoint
app.post('/send-email', async (req, res) => {
  const { to, subject, text } = req.body;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text
    });
    res.status(200).json({ message: 'Email sent successfully!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// New: send OTP
app.post('/send-otp', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const otp = generateOTP();
  otpStore[email] = otp; // remember it for verification later

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your OTP Code',
      text: `Your verification code is: ${otp}`
    });
    res.status(200).json({ message: 'OTP sent to email!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// New: verify OTP
app.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  if (otpStore[email] === otp) {
    delete otpStore[email]; // used once, then discard
    return res.status(200).json({ message: 'OTP verified successfully!' });
  }

  res.status(400).json({ error: 'Invalid OTP' });
});
app.post('/submit-project', async (req, res) => {
  const { teamName, projectName, email } = req.body;

  if (!teamName || !projectName || !email) {
    return res.status(400).json({ error: 'teamName, projectName, and email are all required' });
  }

  // Check for duplicate submission
  let isDuplicate = false;
  for (let i = 0; i < submissions.length; i++) {
    if (submissions[i].teamName === teamName && submissions[i].email === email) {
      isDuplicate = true;
    }
  }

  if (isDuplicate) {
    return res.status(400).json({ error: 'This team has already submitted a project!' });
  }

  // Not a duplicate — save it and proceed
  submissions.push({ teamName, email });

  const submissionId = idGenerator();

  try {
    await Promise.all([
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Project Submission Received',
        text: `Hi ${teamName},\n\nWe've received your submission for "${projectName}".\nYour submission ID is: ${submissionId}\n\nGood luck!`
      }),
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: 'New Project Submission',
        text: `New submission received.\n\nTeam: ${teamName}\nProject: ${projectName}\nEmail: ${email}\nSubmission ID: ${submissionId}`
      })
    ]);

    res.status(200).json({
      message: 'Submission successful! Confirmation emails sent.',
      submissionId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));