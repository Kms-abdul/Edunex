import React from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { Field, Alert } from '../ui';

export interface DocumentType {
  id: number;
  code: string;
  name: string;
}

export interface PendingDocument {
  document_type_id: number;
  document_type_name: string;
  document_no: string;
  file: File;
}

/**
 * "Documents (optional)": pick a type + file, add it to the list.
 * Files are only uploaded when the student is saved (handled by the parent).
 */
const AdmissionDocuments: React.FC<{
  documentTypes: DocumentType[];
  docTypeId: string;
  onDocTypeId: (v: string) => void;
  docNo: string;
  onDocNo: (v: string) => void;
  docFile: File | null;
  onDocFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAdd: () => void;
  pending: PendingDocument[];
  onRemove: (index: number) => void;
  error?: string;
  success?: string;
  /** Changes when the form is cleared, so the file input empties too. */
  fileInputKey?: React.Key;
}> = ({ documentTypes, docTypeId, onDocTypeId, docNo, onDocNo, docFile, onDocFile, onAdd, pending, onRemove, error, success, fileInputKey }) => (
  <section className="card">
    <div className="card-header">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Documents (optional)</h3>
        <p className="text-sm text-slate-500">Add birth certificate, TC and others. You can skip this.</p>
      </div>
    </div>
    <div className="card-body space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Document" htmlFor="document-type">
          <select id="document-type" className="input min-h-[44px]" value={docTypeId} onChange={e => onDocTypeId(e.target.value)}>
            <option value="">Choose…</option>
            {documentTypes.map(doc => (
              <option key={doc.id} value={String(doc.id)}>{doc.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Document number (optional)" htmlFor="document-no">
          <input id="document-no" type="text" className="input min-h-[44px]" value={docNo} onChange={e => onDocNo(e.target.value)} />
        </Field>
        <Field label="File" htmlFor="document-file" hint={docFile ? docFile.name : undefined}>
          <input
            key={fileInputKey}
            id="document-file"
            type="file"
            className="w-full text-sm text-slate-500 file:mr-3 file:min-h-[44px] file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
            onChange={onDocFile}
          />
        </Field>
      </div>

      <button type="button" onClick={onAdd} className="btn-secondary min-h-[44px] w-full sm:w-auto">
        <Plus className="h-4 w-4" /> Add this document
      </button>
      {error && <Alert tone="error">{error}</Alert>}
      {success && !error && <Alert tone="success">{success}</Alert>}

      {pending.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-800 mb-2">Will be uploaded when you save ({pending.length})</p>
          <ul className="space-y-2">
            {pending.map((doc, index) => (
              <li key={`${doc.document_type_id}-${index}`} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                <FileText className="h-5 w-5 flex-shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{doc.document_type_name}</p>
                  {doc.document_no && <p className="text-xs text-slate-500">No. {doc.document_no}</p>}
                  <p className="text-xs text-slate-500 truncate">{doc.file.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="btn-ghost btn-sm min-h-[44px] text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  </section>
);

export default AdmissionDocuments;
