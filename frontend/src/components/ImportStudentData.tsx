import React, { useState } from 'react';
import api from '../api';
import { ImportIcon, DownloadIcon } from './icons';
import { notify } from './ui/feedback';
import { Alert } from './ui';

interface ImportStudentDataProps {
    onImportSuccess: () => void;
}

const ImportStudentData: React.FC<ImportStudentDataProps> = ({ onImportSuccess }) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadStatus, setUploadStatus] = useState<string>('');
 
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setSelectedFile(event.target.files[0]);
            setUploadStatus('');
        }
    };

    const handleUpload = async () => {
        if (selectedFile) {
            const formData = new FormData();
            formData.append('file', selectedFile);


            setUploadStatus('Uploading...');

            try {


                const response = await api.post('/students/upload_csv', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                });

                const result = response.data;
                setUploadStatus(result.message || 'Upload successful!');
                setTimeout(() => {
                    onImportSuccess();
                }, 1500);

            } catch (error: any) {
                console.error("Upload error:", error);
                if (error.response) {
                    console.error("Backend response data:", error.response.data);
                    const data = error.response.data;
                    if (data.errors && data.errors.length > 0) {
                        setUploadStatus(`Upload failed. Errors: ${data.errors.join(', ')}`);
                    } else {
                        setUploadStatus(`Error: ${data.error || data.message || 'Upload failed'}`);
                    }
                } else if (error.request) {
                    setUploadStatus("Network error: No response from server. Ensure backend is running.");
                } else {
                    setUploadStatus(`Error: ${error.message}`);
                }
            }
        } else {
            setUploadStatus('Please select a file to upload.');
        }
    };

    const handleDownloadTemplate = async () => {
        try {
            const response = await api.get('/students/template', {
                responseType: 'blob', // Important for binary data
            });

            // Create a link to download the blob
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'student_import_template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error("Error downloading template:", error);
            notify("Failed to download template. Please check if backend is running.");
        }
    };

    const instructions = [
        "Please don't make any changes in given template.",
        "Only 2000 records are accepted in the list at a time.",
        "The data should be in valid format to upload successfully.",
        "Student and father first name is mandatory field to import data.",
        "Mobile no and Adhar no should be in text format.(Setting- Format cells)",
        "Date should be in DD/MM/YYYY Format only using separators (/, - , .)",
        "For Status please enter 0 for new and 1 for Promoted student.",
        "For Gender please enter 1 for male, 2 for female, 3 for other.",
        "Please make a separate file for each class.",
        "Section column is mandatory.",
        "For student type (Enter 1 for day scholar and 2 for hosteller) otherwise considered as day scholar."
    ];

    return (
        <div className="p-4 md:p-6 bg-surface-muted">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Side: Upload Section */}
                <div className="card">
                    <div className="card-header justify-start">
                        <ImportIcon className="w-6 h-6 text-slate-500" />
                        <h2 className="text-base font-semibold text-slate-900">Import Student Data</h2>
                        <a href="#" className="text-sm text-brand-600 hover:underline">Get Help</a>
                    </div>
                    <div className="card-body space-y-4">
                        <label className="label">Browse for the excel sheet:</label>
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                            <label className="btn-secondary cursor-pointer">
                                Choose File
                                <input type="file" className="hidden" onChange={handleFileChange} accept=".csv, .xlsx, .xls" />
                            </label>
                            <input
                                type="text"
                                value={selectedFile ? selectedFile.name : "No file chosen"}
                                readOnly
                                className="input"
                            />
                            <button onClick={handleUpload} className="btn-success">
                                Upload Excel
                            </button>
                        </div>
                        {uploadStatus && <Alert tone={uploadStatus.includes('successfully') ? 'success' : 'error'} className="mt-2">{uploadStatus}</Alert>}
                    </div>
                </div>

                {/* Right Side: Instructions Section */}
                <div className="card bg-red-50 border-l-4 border-l-red-500">
                    <div className="card-body">
                        <h3 className="text-base font-semibold text-red-700 mb-3">Important Instruction</h3>
                        <p className="text-sm text-slate-700 mb-4">Note: Please read the following instructions:</p>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
                            {instructions.map((inst, index) => (
                                <li key={index}>{inst}</li>
                            ))}
                        </ol>
                        <div className="mt-6">
                            <button
                                onClick={handleDownloadTemplate}
                                className="btn-primary"
                            >
                                <DownloadIcon className="w-5 h-5" />
                                <span>Download Excel Template</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImportStudentData;
