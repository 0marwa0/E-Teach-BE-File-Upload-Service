import { S3Client, PutObjectCommand,DeleteObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import express from 'express';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 6002;

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

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
    console.log('Request received:', req.body);
    const { meetingId, originalFileName } = req.body;

    if (!meetingId || !originalFileName) {
      console.error('Missing required fields');
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields' 
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
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
});
const FINAL_BUCKET = process.env.FINAL_BUCKET;
const TEMP_BUCKET = process.env.TEMP_BUCKET;
app.post ("/webhook/s3-final-upload",async (req,res)=>{
  try {

const snsRecord = req.body.Records;

for (const record of snsRecord) {
  const message=JSON.parse(record.Sns.Message);
  const s3Record=message.Records[0];
const key=decodeURIComponent(s3Record.s3.object.key)
const meetingId=key.split("/")[0];
await s3.send(new DeleteObjectCommand({
  Bucket:TEMP_BUCKET,
  Key:key
}))

await s3.send(new CopyObjectCommand({
  Bucket:FINAL_BUCKET,
  Key:key,
  CopySource:`${TEMP_BUCKET}/${key}`
}))

// to do 
// store it in database
// send it to realtime service
}
} catch (error) {
  console.error('Error in /webhook/s3-final-upload:', error);
  res.status(500).json({ 
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? undefined : error.message
  });
}})




app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});