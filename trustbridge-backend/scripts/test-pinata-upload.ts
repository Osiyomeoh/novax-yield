import * as dotenv from 'dotenv';
import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const PINATA_API_KEY = process.env.PINATA_API_KEY || '';
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY || '';
const PINATA_GATEWAY_URL = process.env.PINATA_GATEWAY_URL || 'gateway.pinata.cloud';

interface UploadResult {
  cid: string;
  ipfsUrl: string;
  pinSize: number;
}

/**
 * Upload a file to Pinata IPFS
 */
async function uploadFile(filePath: string, fileName?: string): Promise<UploadResult> {
  if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
    throw new Error('PINATA_API_KEY and PINATA_SECRET_KEY must be set in .env file');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileBuffer = fs.readFileSync(filePath);
  const actualFileName = fileName || path.basename(filePath);

  const formData = new FormData();
  formData.append('file', fileBuffer, {
    filename: actualFileName,
    contentType: 'application/octet-stream'
  });

  formData.append('pinataMetadata', JSON.stringify({
    name: actualFileName,
    keyvalues: {
      uploadedBy: 'test-script',
      uploadTime: new Date().toISOString(),
      test: 'true'
    }
  }));

  formData.append('pinataOptions', JSON.stringify({
    cidVersion: 1
  }));

  console.log(`📤 Uploading file: ${actualFileName} (${fileBuffer.length} bytes)...`);

  try {
    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      formData,
      {
        headers: {
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_KEY,
          ...formData.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    const { IpfsHash, PinSize } = response.data;
    const ipfsUrl = `https://${PINATA_GATEWAY_URL}/ipfs/${IpfsHash}`;

    console.log('✅ Upload successful!');
    console.log(`   CID: ${IpfsHash}`);
    console.log(`   IPFS URL: ${ipfsUrl}`);
    console.log(`   Size: ${PinSize} bytes`);

    return {
      cid: IpfsHash,
      ipfsUrl,
      pinSize: PinSize
    };
  } catch (error: any) {
    console.error('❌ Upload failed:');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('   Error:', error.message);
    }
    throw error;
  }
}

/**
 * Upload JSON data to Pinata IPFS
 */
async function uploadJson(data: any, fileName?: string): Promise<UploadResult> {
  if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
    throw new Error('PINATA_API_KEY and PINATA_SECRET_KEY must be set in .env file');
  }

  const pinataMetadata = {
    name: fileName || `json-${Date.now()}.json`,
    keyvalues: {
      type: 'json',
      uploadedBy: 'test-script',
      uploadTime: new Date().toISOString(),
      test: 'true'
    }
  };

  const pinataOptions = {
    cidVersion: 1
  };

  console.log(`📤 Uploading JSON data...`);

  try {
    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      {
        pinataContent: data,
        pinataMetadata,
        pinataOptions
      },
      {
        headers: {
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const { IpfsHash, PinSize } = response.data;
    const ipfsUrl = `https://${PINATA_GATEWAY_URL}/ipfs/${IpfsHash}`;

    console.log('✅ Upload successful!');
    console.log(`   CID: ${IpfsHash}`);
    console.log(`   IPFS URL: ${ipfsUrl}`);
    console.log(`   Size: ${PinSize} bytes`);

    return {
      cid: IpfsHash,
      ipfsUrl,
      pinSize: PinSize
    };
  } catch (error: any) {
    console.error('❌ Upload failed:');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('   Error:', error.message);
    }
    throw error;
  }
}

/**
 * List all pinned files
 */
async function listFiles(): Promise<void> {
  if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
    throw new Error('PINATA_API_KEY and PINATA_SECRET_KEY must be set in .env file');
  }

  console.log('📋 Fetching pinned files...');

  try {
    const response = await axios.get(
      'https://api.pinata.cloud/data/pinList',
      {
        headers: {
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_KEY
        }
      }
    );

    const files = response.data.rows || [];
    console.log(`✅ Found ${files.length} pinned files:\n`);

    if (files.length === 0) {
      console.log('   No files found.');
      return;
    }

    files.forEach((file: any, index: number) => {
      console.log(`${index + 1}. ${file.metadata?.name || 'Unnamed'}`);
      console.log(`   CID: ${file.ipfs_pin_hash}`);
      console.log(`   Size: ${file.size} bytes`);
      console.log(`   Date: ${new Date(file.date_pinned).toLocaleString()}`);
      console.log('');
    });
  } catch (error: any) {
    console.error('❌ Failed to list files:');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('   Error:', error.message);
    }
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    if (command === 'file' && args[1]) {
      // Upload a file
      const filePath = args[1];
      const fileName = args[2]; // Optional custom filename
      await uploadFile(filePath, fileName);
    } else if (command === 'json') {
      // Upload JSON data
      const jsonData = args[1] ? JSON.parse(args[1]) : {
        test: true,
        message: 'Test JSON upload from Pinata script',
        timestamp: new Date().toISOString(),
        data: {
          example: 'This is a test JSON upload',
          version: '1.0.0'
        }
      };
      const fileName = args[2] || `test-${Date.now()}.json`;
      await uploadJson(jsonData, fileName);
    } else if (command === 'list') {
      // List all pinned files
      await listFiles();
    } else {
      console.log('Usage:');
      console.log('  ts-node scripts/test-pinata-upload.ts file <file-path> [custom-filename]');
      console.log('  ts-node scripts/test-pinata-upload.ts json [json-string] [filename]');
      console.log('  ts-node scripts/test-pinata-upload.ts list');
      console.log('');
      console.log('Examples:');
      console.log('  ts-node scripts/test-pinata-upload.ts file ./test.txt');
      console.log('  ts-node scripts/test-pinata-upload.ts json \'{"test": true}\' my-data.json');
      console.log('  ts-node scripts/test-pinata-upload.ts list');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();

