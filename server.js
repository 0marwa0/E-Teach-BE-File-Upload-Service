import express from 'express';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 6002;

// S3 config
const s3 = new S3Client({ region: "eu-north-1"});

app.use(express.json());

// POST /generate-upload-url
app.post('/generate-upload-url', async (req, res) => {
  try {
    const { meetingId, originalFileName } = req.body;

    if (!meetingId || !originalFileName) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }

    const fileExtension = originalFileName.split('.').pop();
    const fileKey = `meetings/${meetingId}/${uuidv4()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket:"upload-file-temp-bucket",
      Key: fileKey,
      ContentType: 'application/octet-stream',
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 min

    return res.json({ uploadUrl: signedUrl, fileKey });
  } catch (error) {
    console.error('Failed to generate signed URL:', error);
    res.status(500).json({ message: 'Error generating signed URL' });
  }
});

app.listen(PORT, () => {
  console.log(`Upload service running on port ${PORT}`);
});
