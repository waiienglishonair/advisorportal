import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || '';
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '';

function getDriveClient() {
    const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
    oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
    return google.drive({ version: 'v3', auth: oauth2Client });
}

async function getOrCreateFolder(drive: any, parentId: string, folderName: string): Promise<string> {
    try {
        // Search for existing folder
        const response = await drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentId}' in parents and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive',
        });

        if (response.data.files && response.data.files.length > 0) {
            return response.data.files[0].id; // Folder exists
        }

        // Folder doesn't exist, create it
        const folder = await drive.files.create({
            requestBody: {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentId],
            },
            fields: 'id',
        });

        return folder.data.id;
    } catch (error: any) {
        console.error(`Error getting/creating folder '${folderName}':`, error?.message);
        throw error;
    }
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const files = formData.getAll('files') as File[];

        // Extract metadata
        const clientName = (formData.get('clientName') as string) || 'UnknownClient';
        const productsStr = formData.get('products') as string;
        let products: string[] = ['UnknownProduct'];
        try {
            if (productsStr) products = JSON.parse(productsStr);
        } catch (e) {
            // fallback if not valid JSON
            products = [productsStr];
        }

        if (!files || files.length === 0) {
            return NextResponse.json({ success: false, message: 'No files provided' }, { status: 400 });
        }

        if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
            console.error('Missing Google OAuth2 credentials. Run: node setup-google-auth.js');
            return NextResponse.json({ success: false, message: 'Google OAuth2 not configured. Run setup-google-auth.js first.' }, { status: 500 });
        }

        const drive = getDriveClient();
        const uploadedUrls: string[] = [];
        let primaryFolderUrl = '';

        // Prepare hierarchy structures (Year and Month)
        const now = new Date();
        const yearStr = now.getFullYear().toString();
        const monthStr = now.toLocaleString('default', { month: 'long' }); // e.g. "March"

        for (const file of files) {
            const fileName = `${Date.now()}-${file.name}`;
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // If there are multiple products selected, we need to upload the file to ALL of their folders.
            // But realistically, uploading multiple copies is slow. 
            // In the original code.gs logic, it looped over Products and uploaded to each:
            // "reviewData.Products.forEach(prodName => { ... files.forEach(file => { ... createFile }) })"

            for (const prodName of products) {
                // Determine target folder ID by traversing the tree
                // Root -> Product -> Year -> Month -> Client
                const prodFolderId = await getOrCreateFolder(drive, FOLDER_ID, prodName);
                const yearFolderId = await getOrCreateFolder(drive, prodFolderId, yearStr);
                const monthFolderId = await getOrCreateFolder(drive, yearFolderId, monthStr);
                const clientFolderId = await getOrCreateFolder(drive, monthFolderId, clientName);

                if (!primaryFolderUrl) {
                    primaryFolderUrl = `https://drive.google.com/drive/folders/${clientFolderId}`;
                }

                try {
                    const stream = Readable.from(buffer);
                    const response = await drive.files.create({
                        requestBody: {
                            name: fileName,
                            parents: [clientFolderId],
                        },
                        media: {
                            mimeType: file.type || 'application/octet-stream',
                            body: stream,
                        },
                        fields: 'id, webViewLink',
                    });

                    const fileId = response.data.id;

                    if (fileId) {
                        try {
                            await drive.permissions.create({
                                fileId: fileId,
                                requestBody: { role: 'reader', type: 'anyone' },
                            });
                        } catch (permErr: any) {
                            console.warn('Permission warning:', permErr?.message);
                        }

                        const viewUrl = response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

                        // We only need to return the URL once per file (we can return the first uploaded one)
                        // Or if we upload it to multiple product folders, we just return the first one.
                        if (uploadedUrls.indexOf(viewUrl) === -1) {
                            uploadedUrls.push(viewUrl);
                        }
                        console.log(`✅ Uploaded: ${fileName} -> ${clientFolderId}`);
                    }
                } catch (uploadErr: any) {
                    console.error('Drive upload error:', uploadErr?.message);
                    uploadedUrls.push(`upload-failed://${file.name}`);
                }
            } // end products loop
        } // end files loop

        return NextResponse.json({ success: true, folderUrl: primaryFolderUrl, urls: uploadedUrls });
    } catch (error: any) {
        console.error('Upload error:', error?.message);
        return NextResponse.json(
            { success: false, message: error?.message || 'Upload failed' },
            { status: 500 }
        );
    }
}
