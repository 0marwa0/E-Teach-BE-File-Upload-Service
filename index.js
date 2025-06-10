const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const express = require('express');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 6002;

// S3 config with explicit credentials
const s3 = new S3Client({ 
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

app.use(express.json());

app.get("/", (req, res) => {
  res.send("File Upload Service is running!");
});

app.post('/generate-upload-url', async (req, res) => {
  try {
    console.log('Request received:', req.body); // Debug log
    const { meetingId, originalFileName } = req.body;

    if (!meetingId || !originalFileName) {
      console.error('Missing required fields');
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields: meetingId and originalFileName are required' 
      });
    }

    const fileExtension = originalFileName.split('.').pop();
    const fileKey = `meetings/${meetingId}/${uuidv4()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: process.env.TEMP_UPLOAD_BUCKET || 'upload-file-temp-bucket',
      Key: fileKey,
      ContentType: 'application/octet-stream',
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    console.log('Generated signed URL for:', fileKey);
    
    return res.json({ 
      success: true,
      uploadUrl: signedUrl, 
      fileKey 
    });

  } catch (error) {
    console.error('Error in /generate-upload-url:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to generate signed URL',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});