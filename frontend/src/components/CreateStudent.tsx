import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { CheckCircle2, Wallet, UserPlus, ArrowLeft, Pencil } from "lucide-react";
import api from "../api";
import type { Page } from "../App";
import { notify } from './ui/feedback';
import { Steps, ActionBar, Button, Alert, DataList, confirmDialog } from './ui';
import type { Column } from './ui';
import {
  AdmissionFormContext, TextField, SelectField, ChoiceField, CheckField, Toggle,
  ReadOnlyField, MoreDetails, PhotoPicker, Group, fieldId,
} from './admission/fields';
import type { AdmissionFormCtx } from './admission/fields';
import AdmissionSummary from './admission/AdmissionSummary';
import { StepRail, LiveSummary } from './admission/AdmissionSidePanels';
import AdmissionDocuments from './admission/AdmissionDocuments';
import type { DocumentType, PendingDocument } from './admission/AdmissionDocuments';
import {
  ADMISSION_STEPS, REVIEW_STEP, REQUIRED_FIELDS, LABELS, findErrors, errorsInStep, firstStepWithError,
  STUDENT_MORE, FATHER_MORE, MOTHER_MORE, GUARDIAN, PREVIOUS_SCHOOL,
} from './admission/admissionSteps';

interface CreateStudentProps {
  mode: "create" | "view" | "edit";
  studentData?: any;
  onSave?: (data: any, exit: boolean) => void;
  onCancel: () => void;
  onEdit?: () => void;
  /** Optional: lets the "Collect fee for this student" button open Take Fee after saving. */
  navigateTo?: (page: Page) => void;
}

const CreateStudent: React.FC<CreateStudentProps> = ({
  mode,
  studentData,
  onSave,
  onCancel,
  onEdit,
  navigateTo,
}) => {
  const formRef = useRef<HTMLFormElement>(null);
  const [classList, setClassList] = useState<string[]>([]);
  const [sectionList, setSectionList] = useState<string[]>([]);
  const [branchOptions, setBranchOptions] = useState<{ branch_name: string, location_code: string }[]>([]);
  const [locationOptions, setLocationOptions] = useState<{ code: string, name: string }[]>([]);
  const [academicYearOptions, setAcademicYearOptions] = useState<{ code: string, name: string }[]>([]);
  const isViewMode = mode === "view";
  const currentBranch = localStorage.getItem("currentBranch");
  const isAllBranch = currentBranch === "All" || currentBranch === "All Branches";
  const canSelectBranch = mode === "create" && isAllBranch;
  const currentLocation = localStorage.getItem("currentLocation");
  const isAllLocation = currentLocation === "All" || currentLocation === "All Locations";
  const canSelectLocation = mode === "create" && isAllLocation;



  const initialFormData: Record<string, any> = {
    admissionNo: "",
    enrollment_no: "",
    first_name: "",
    last_name: "",
    gender: "",
    dob: "",
    Doa: "",
    BloodGroup: "",
    Adharcardno: "",
    Religion: "",
    phone: "",
    email: "",
    address: "",
    Category: "",
    class: "",
    section: "",
    Roll_Number: "",
    admission_date: new Date().toISOString().split('T')[0],
    status: "Active",
    MotherTongue: "",
    Caste: "",
    StudentType: "",
    House: "",
    StudentHeight: "",
    StudentWeight: "",
    SamagraId: "",
    ChildId: "",
    PEN: "",
    permanentCity: "",
    previousSchoolName: "",
    primaryIncomePerYear: "",
    secondaryIncomePerYear: "",
    primaryOfficeAddress: "",
    secondaryOfficeAddress: "",
    Hobbies: "",
    SecondLanguage: "",
    ThirdLanguage: "",
    GroupUniqueId: "",
    serviceNumber: "",
    EmploymentservingStatus: "",
    StudentStatus: "",
    ApaarId: "",
    Stream: "",
    EmploymentCategory: "",
    Fatherfirstname: "",
    FatherLastName: "",
    FatherPhone: "",
    SmsNo: "",
    FatherEmail: "",
    PrimaryQualification: "",
    FatherOccuption: "",
    FatherCompany: "",
    FatherDesignation: "",
    FatherAadhar: "",
    FatherOrganizationId: "",
    FatherOtherOrganization: "",
    Motherfirstname: "",
    MothermiddleName: "",
    Motherlastname: "",
    SecondaryPhone: "",
    SecondaryEmail: "",
    SecondaryQualification: "",
    SecondaryOccupation: "",
    SecondaryCompany: "",
    SecondaryDesignation: "",
    MotherAadhar: "",
    MotherOrganizationId: "",
    MotherOtherOrganization: "",
    GuardianName: "",
    GuardianRelation: "",
    GuardianQualification: "",
    GuardianOccupation: "",
    GuardianDesignation: "",
    GuardianDepartment: "",
    GuardianOfficeAddress: "",
    GuardianContactNo: "",

    AdmissionCategory: "",
    AdmissionClass: "",
    location: localStorage.getItem('location') || '',
    branch: localStorage.getItem('branch') || '',
    academic_year: localStorage.getItem('academicYear') || "",
    presentAddress: "",
    presentCity: "",
    presentPin: "",
    permanentAddress: "",
    permanentCity_ui: "",
    isSameAddress: false,
    // Previous School Details (New Fields)
    SchoolName: "",
    PreviousSchoolClass: "",
    TCNumber: "",
    PreviousAdmissionNumber: "",
  };

  const [formData, setFormData] = useState<Record<string, any>>(initialFormData);



  // Helper to derive location from branch name
  const deriveLocationFromBranch = (branchName: string, branches: any[], availableLocations: any[]) => {
    const selectedBranch = branches.find((b: any) => b.branch_name === branchName);
    if (selectedBranch) {
      const code = (selectedBranch.location_code || '').trim().toUpperCase();
      // Find matching location by code (case-insensitive)
      const match = availableLocations.find(l => l.code.toUpperCase() === code);
      if (match) {
        return match.name;
      }
    }
    return "";
  };

  // Photos
  const [studentPhoto, setStudentPhoto] = useState<string | null>(null);
  const [fatherPhoto, setFatherPhoto] = useState<string | null>(null);
  const [motherPhoto, setMotherPhoto] = useState<string | null>(null);
  const [guardianPhoto, setGuardianPhoto] = useState<string | null>(null);

  // History State
  const [academicHistory, setAcademicHistory] = useState<any[]>([]);

  // Documents
  const [checkedDocuments, setCheckedDocuments] = useState<string[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [selectedDocTypeId, setSelectedDocTypeId] = useState<string>("");
  const [selectedDocNo, setSelectedDocNo] = useState<string>("");
  const [selectedDocFile, setSelectedDocFile] = useState<File | null>(null);
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [documentUploadError, setDocumentUploadError] = useState<string>("");
  const [documentUploadSuccess, setDocumentUploadSuccess] = useState<string>("");

  // --- Step-by-step UI state (no effect on what is saved) ---
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attemptedSteps, setAttemptedSteps] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  /** After a successful create: what to show on the "Student saved" screen. */
  const [savedStudent, setSavedStudent] = useState<{ data: any; name: string; classLabel: string; uploadProblem?: string } | null>(null);
  /** Last create response, so leaving later still refreshes the list (onSave) like before. */
  const lastSavedRef = useRef<any>(null);
  /** "Same as father's phone" ticks for the main phone and SMS number. */
  const [sameAsFather, setSameAsFather] = useState<{ phone: boolean; SmsNo: boolean }>({ phone: false, SmsNo: false });
  /** In edit mode the admission class stays locked when the student already had one. */
  const [admissionClassLocked, setAdmissionClassLocked] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  // Load student data for edit/view
  useEffect(() => {
    if (studentData) {
      console.log("CreateStudent received studentData:", studentData);
      console.log("Keys in studentData:", Object.keys(studentData));

      const mapped = { ...initialFormData };

      Object.keys(initialFormData).forEach((key) => {
        const val =
          studentData[key] ??
          studentData[key.replace(/_/g, "")] ??
          studentData[key.toLowerCase()] ??
          mapped[key];

        mapped[key] = val;

        // Debug specific fields
        if (["Roll_Number", "AdmissionCategory", "StudentStatus", "BloodGroup"].includes(key)) {
          console.log(`Mapping ${key}: studentData[${key}]=${studentData[key]}, Result=${val}`);
        }
      });

      // Normalize Branch and Location (Case-insensitive match)
      // Removed hardcoded branch normalization to support dynamic branches
      // const branchOptions = ["North", "South", "East", "West", "NorthEast"];
      // if (mapped.branch) {
      //   const match = branchOptions.find(opt => opt.toLowerCase() === mapped.branch.trim().toLowerCase());
      //   if (match) mapped.branch = match;
      // }

      const locationOptions = ["Hyderabad", "Mumbai", "Bangalore"];
      if (mapped.location) {
        const match = locationOptions.find(opt => opt.toLowerCase() === mapped.location.trim().toLowerCase());
        if (match) mapped.location = match;
      }

      mapped.admissionNo = studentData.admission_no ?? mapped.admissionNo;
      mapped.presentAddress = studentData.address ?? "";
      mapped.presentCity = studentData.presentCity ?? "";
      mapped.presentPin = studentData.presentPin ?? "";
      mapped.permanentAddress = studentData.permanentAddress ?? "";
      mapped.permanentCity_ui = studentData.permanentCity ?? "";
      mapped.permanentPin = studentData.permanentPin ?? "";
      mapped.isSameAddress = !!mapped.presentAddress
        && mapped.permanentAddress === mapped.presentAddress
        && mapped.permanentCity_ui === mapped.presentCity
        && mapped.permanentPin === mapped.presentPin;
      mapped.class = studentData.class ?? studentData.clazz ?? "";

      // Explicit Mapping for Previous School Details
      mapped.SchoolName = studentData.SchoolName || "";
      mapped.PreviousSchoolClass = studentData.PreviousSchoolClass || "";
      mapped.TCNumber = studentData.TCNumber || "";
      mapped.PreviousAdmissionNumber = studentData.AdmissionNumber || ""; // Back from backend is AdmissionNumber

      console.log("Mapped formData:", mapped);
      setFormData(mapped);
      setAdmissionClassLocked(mode === "edit" && !!mapped.AdmissionClass);
      setCheckedDocuments(studentData.documents || []);
      setMotherPhoto(studentData.photos?.mother || null);
      setGuardianPhoto(studentData.photos?.guardian || null);

      // Fetch History
      if (studentData.student_id || studentData.id) {
        api.get(`/students/${studentData.student_id || studentData.id}/history`)
          .then(res => setAcademicHistory(res.data.history || []))
          .catch(console.error);
      }
    }
  }, [studentData]);

  // Consolidated into the main useEffect above to ensure we have branches loaded before deriving location
  // Leaving this empty or removing.
  useEffect(() => {
    // Intentionally left empty - logic moved to combined useEffect
  }, []);
  useEffect(() => {
    const fetchSections = async () => {
      if (!formData.class) {
        setSectionList([]);
        return;
      }

      try {
        const branch = formData.branch || localStorage.getItem('currentBranch') || 'All';
        const academicYear = formData.academic_year || localStorage.getItem('academicYear') || '';
        const res = await api.get('/sections', {
          params: {
            class: formData.class,
            branch,
            academic_year: academicYear,
          }
        });
        setSectionList(res.data.sections || []);
      } catch (err) {
        console.error('Failed to load sections', err);
        setSectionList([]);
      }
    };

    fetchSections();
  }, [formData.class, formData.branch, formData.academic_year]);
  useEffect(() => {
    // Fetch Classes
    api
      .get(`/classes`)
      .then((res) => {
        const list = res.data.classes || [];
        list.sort((a: any, b: any) => a.id - b.id);
        setClassList(list.map((c: any) => c.class_name));
      })
      .catch((err) => {
        console.error("Failed to load classes", err);
      });

    const loadDocumentTypes = async () => {
      try {
        const res = await api.get('/documents/types');
        setDocumentTypes(res.data || []);
      } catch (err) {
        console.error('Failed to load document types', err);
      }
    };
    loadDocumentTypes();

    // Fetch Master Data: Branches, Locations, Academic Years
    Promise.all([
      api.get("/branches"),
      api.get("/org/locations"),
      api.get("/org/academic-years")
    ])
      .then(([branchRes, locRes, yearRes]) => {
        // 1. Process Locations
        const locs = locRes.data.locations || [];
        setLocationOptions(locs);

        // 2. Process Academic Years
        const years = yearRes.data.academic_years || [];
        setAcademicYearOptions(years);

        // 3. Process Branches
        let branches: any[] = [];
        if (branchRes.data.branches) {
          branches = branchRes.data.branches.map((b: any) => ({
            branch_name: b.branch_name,
            location_code: b.location_code
          }));
          setBranchOptions(branches);
        }

        // 4. Auto-Set Branch and Location (if in Create mode)
        if (mode === "create") {
          const savedBranch = localStorage.getItem("currentBranch");
          const savedUser = localStorage.getItem("user");
          let userBranch = "";

          if (savedUser) {
            try {
              const u = JSON.parse(savedUser);
              userBranch = u.branch;
            } catch (e) {
              console.error("Error parsing user from localStorage", e);
            }
          }

          let targetBranch = "";
          const isAllBranch = savedBranch === "All" || savedBranch === "All Branches";

          if (savedBranch && !isAllBranch) {
            targetBranch = savedBranch;
          } else if (userBranch) {
            targetBranch = userBranch;
          }

          if (!targetBranch && !isAllBranch) {
            const storedBranch = localStorage.getItem("branch") || "";
            if (storedBranch) {
              targetBranch = storedBranch;
            } else if (branches.length > 0) {
              targetBranch = branches[0].branch_name;
            }
          }

          if (targetBranch) {
            // Pass the loaded 'branches' and 'locs' to the helper
            const derivedLoc = deriveLocationFromBranch(targetBranch, branches, locs);

            let normalizedYear = formData.academic_year;
            // Normalize Academic Year: Match "2025-2026" to "2025 - 2026"
            const currentYearLocal = localStorage.getItem('academicYear') || "";
            const yearMatch = years.find((y: any) => y.name.replace(/\s/g, '') === currentYearLocal.replace(/\s/g, ''));
            if (yearMatch) {
              normalizedYear = yearMatch.name;
            }

            setFormData(prev => ({
              ...prev,
              branch: targetBranch,
              location: derivedLoc || prev.location,
              academic_year: normalizedYear
            }));
          } else if (isAllBranch) {
            setFormData(prev => ({
              ...prev,
              branch: "",
              location: "",
              academic_year: prev.academic_year || (localStorage.getItem("academicYear") || "")
            }));
          }
        }

      })
      .catch(err => console.error("Failed to load master data", err));

  }, [mode]);

  // Removing logic from the other useEffect to avoid conflicts? 
  // The other useEffect [mode] (lines 398-429) was doing similar thing but without access to branchOptions for location.
  // I will leave that one empty or remove it. Better to remove it to avoid double setting.

  // Handle Inputs  
  const handleInputChange = useCallback(
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => {
      const { name, value, type } = e.target;

      if (isViewMode) return;

      // Auto-update location when branch changes
      if (name === 'branch') {
        const newLocation = deriveLocationFromBranch(value, branchOptions, locationOptions);
        setFormData(prev => ({ ...prev, [name]: value, location: newLocation || prev.location }));
        return;
      }

      // Checkbox logic
      if (type === "checkbox") {
        const { checked } = e.target as HTMLInputElement;

        setFormData((prev) => {
          const updated = { ...prev, [name]: checked };
          if (name === "isSameAddress") {
            updated.permanentAddress = checked ? prev.presentAddress : "";
            updated.permanentCity_ui = checked ? prev.presentCity : "";
            updated.permanentPin = checked ? prev.presentPin : "";
          }
          return updated;
        });
        return;
      }

      // Aadhaar Formatting
      if (
        name === "Adharcardno" ||
        name === "FatherAadhar" ||
        name === "MotherAadhar"
      ) {
        let digits = value.replace(/\D/g, "").slice(0, 12);
        const formatted = digits.match(/.{1,4}/g)?.join("-") || "";

        setFormData((prev) => ({
          ...prev,
          [name]: formatted,
        }));
        return;
      }
      if (name === "permanentPin") {
        const digits = value.replace(/\D/g, "").slice(0, 6);
        setFormData((prev) => ({ ...prev, permanentPin: digits }));
        return;
      }
      if (name === "presentPin") {
        // Only digits, max 6
        const digits = value.replace(/\D/g, "").slice(0, 6);

        setFormData((prev) => ({
          ...prev,
          presentPin: digits,
        }));
        return;
      }
      if (name === "Roll_Number") {
        // Allow only digits (no minus, no decimals)
        const digits = value.replace(/\D/g, "");

        setFormData((prev) => ({
          ...prev,
          Roll_Number: digits,
        }));
        return;
      }


      // Phone formatting with +91 prefix
      // Phone formatting with +91 prefix (stable typing)
      if (
        name === "phone" ||
        name === "FatherPhone" ||
        name === "SecondaryPhone" ||
        name === "SmsNo" ||
        name === "GuardianContactNo"
      ) {
        let input = value;

        // Ensure prefix exists
        if (!input.startsWith("+91 ")) {
          // User deleted prefix → restore it
          input = "+91 " + input.replace(/\D/g, "");
        }

        // Extract digits after +91 
        let digits = input.replace("+91 ", "").replace(/\D/g, "");

        // Limit to 10 digits
        digits = digits.slice(0, 10);

        // Final value = "+91 " + digits; empty when no digits so a cleared phone counts as empty
        const finalValue = digits ? "+91 " + digits : "";


        // Update state
        setFormData((prev) => ({
          ...prev,
          [name]: finalValue,
        }));

        return;
      }



      // Changing class: the old section belongs to the old class, so clear it
      if (name === "class") {
        setFormData((prev) => ({ ...prev, class: value, section: prev.class === value ? prev.section : "" }));
        return;
      }

      // Default input
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    },
    // branch/location lists are needed for the branch -> location auto-fill above
    [isViewMode, branchOptions, locationOptions]
  );




  const handlePhotoChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onloadend = () => setter(reader.result as string);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleDocumentFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedDocFile(e.target.files[0]);
    }
  };

  const handleAddPendingDocument = () => {
    setDocumentUploadError("");
    setDocumentUploadSuccess("");

    if (!selectedDocTypeId) {
      setDocumentUploadError("Choose which document this is.");
      return;
    }
    if (!selectedDocFile) {
      setDocumentUploadError("Choose a file first.");
      return;
    }

    const docType = documentTypes.find(
      (doc) => String(doc.id) === selectedDocTypeId
    );

    if (!docType) {
      setDocumentUploadError("This document type is not available. Choose another.");
      return;
    }

    setPendingDocuments((prev) => [
      ...prev,
      {
        document_type_id: docType.id,
        document_type_name: docType.name,
        document_no: selectedDocNo,
        file: selectedDocFile,
      },
    ]);

    setSelectedDocTypeId("");
    setSelectedDocNo("");
    setSelectedDocFile(null);
    setDocumentUploadSuccess("Document added. It will upload when you save.");
  };

  const removePendingDocument = (index: number) => {
    setPendingDocuments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const uploadPendingDocuments = async (studentId: number) => {
    if (pendingDocuments.length === 0) {
      return;
    }

    const failures: string[] = [];

    for (const doc of pendingDocuments) {
      const formData = new FormData();
      formData.append('student_id', String(studentId));
      formData.append('document_type_id', String(doc.document_type_id));
      formData.append('file', doc.file);
      if (doc.document_no) {
        formData.append('document_no', doc.document_no);
      }

      try {
        await api.post('/documents/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      } catch (err: any) {
        failures.push(
          `${doc.document_type_name}: ${err.response?.data?.message || err.message || 'Upload failed'}`
        );
      }
    }

    if (failures.length) {
      throw new Error(failures.join(' | '));
    }

    setPendingDocuments([]);
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setStudentPhoto(null);
    setFatherPhoto(null);
    setMotherPhoto(null);
    setGuardianPhoto(null);
    setCheckedDocuments([]);
    setSelectedDocTypeId("");
    setSelectedDocNo("");
    setSelectedDocFile(null);
    setPendingDocuments([]);
    setDocumentUploadError("");
    setDocumentUploadSuccess("");
  };

  const handleResetClick = async () => {
    const ok = await confirmDialog(
      mode === "edit" ? "Clear every field on this form? Nothing is saved until you press Save." : "Clear everything and start again?",
      { confirmText: "Clear form", tone: "danger" }
    );
    if (!ok) return;
    resetForm();
    setSameAsFather({ phone: false, SmsNo: false });
    setTouched({});
    setAttemptedSteps({});
    goToStep(0);
  };

  // --- Step navigation & per-step checks (same required fields as the save check) ---
  const requiredCheck = mode === "create";
  const errors = useMemo(() => (requiredCheck ? findErrors(formData) : {}), [requiredCheck, formData]);
  const stepErrors = errorsInStep(errors, step);

  const goToStep = (i: number) => {
    setStep(i);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const focusField = (name: string) => {
    const el = document.getElementById(fieldId(name));
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as HTMLElement).focus({ preventScroll: true });
    }
  };

  /** Show the messages on this step and jump to the first problem. */
  const showStepProblems = (i: number) => {
    setAttemptedSteps(prev => ({ ...prev, [i]: true }));
    const first = errorsInStep(errors, i)[0];
    if (first) requestAnimationFrame(() => focusField(first));
  };

  const handleNext = () => {
    if (stepErrors.length) {
      showStepProblems(step);
      return;
    }
    goToStep(Math.min(step + 1, REVIEW_STEP));
  };

  const handleBack = () => {
    if (step > 0) {
      goToStep(step - 1);
      return;
    }
    leave();
  };

  /** Leave the form. If a student was saved in this visit, tell the parent so its list refreshes. */
  const leave = () => {
    if (lastSavedRef.current && onSave) onSave(lastSavedRef.current, true);
    else onCancel();
  };

  const addAnother = () => {
    const keep = { branch: formData.branch, location: formData.location, academic_year: formData.academic_year };
    resetForm();
    setFormData({ ...initialFormData, ...keep });
    setSameAsFather({ phone: false, SmsNo: false });
    setTouched({});
    setAttemptedSteps({});
    setSavedStudent(null);
    goToStep(0);
  };

  // Keep "Same as father's phone" numbers in step with the father's phone
  useEffect(() => {
    if (isViewMode || (!sameAsFather.phone && !sameAsFather.SmsNo)) return;
    setFormData(prev => {
      const next = { ...prev };
      if (sameAsFather.phone) next.phone = prev.FatherPhone;
      if (sameAsFather.SmsNo) next.SmsNo = prev.FatherPhone;
      return next.phone === prev.phone && next.SmsNo === prev.SmsNo ? prev : next;
    });
  }, [sameAsFather, formData.FatherPhone, isViewMode]);

  const buildPayload = () => {
    return {
      admission_no: formData.admissionNo,
      enrollment_no: formData.enrollment_no,
      first_name: formData.first_name,
      last_name: formData.last_name,
      gender: formData.gender,
      dob: formData.dob,
      Doa: formData.Doa,
      BloodGroup: formData.BloodGroup,
      Adharcardno: formData.Adharcardno,
      Religion: formData.Religion,
      phone: formData.phone,
      email: formData.email,
      address: formData.presentAddress,
      Category: formData.Category,
      class: formData.class,
      section: formData.section,
      Roll_Number: formData.Roll_Number ? Number(formData.Roll_Number) : null,
      admission_date: formData.admission_date,
      status: formData.status,
      MotherTongue: formData.MotherTongue,
      Caste: formData.Caste,
      StudentType: formData.StudentType,
      House: formData.House,
      Fatherfirstname: formData.Fatherfirstname,
      FatherPhone: formData.FatherPhone,
      SmsNo: formData.SmsNo,
      FatherEmail: formData.FatherEmail,
      PrimaryQualification: formData.PrimaryQualification,
      FatherOccuption: formData.FatherOccuption,
      FatherCompany: formData.FatherCompany,
      FatherDesignation: formData.FatherDesignation,
      FatherAadhar: formData.FatherAadhar,
      FatherOrganizationId: formData.FatherOrganizationId,
      FatherOtherOrganization: formData.FatherOtherOrganization,
      Motherfirstname: formData.Motherfirstname,
      MothermiddleName: formData.MothermiddleName,
      Motherlastname: formData.Motherlastname,
      SecondaryPhone: formData.SecondaryPhone,
      SecondaryEmail: formData.SecondaryEmail,
      SecondaryQualification: formData.SecondaryQualification,
      SecondaryOccupation: formData.SecondaryOccupation,
      SecondaryCompany: formData.SecondaryCompany,
      SecondaryDesignation: formData.SecondaryDesignation,
      MotherAadhar: formData.MotherAadhar,
      MotherOrganizationId: formData.MotherOrganizationId,
      MotherOtherOrganization: formData.MotherOtherOrganization,
      GuardianName: formData.GuardianName,
      GuardianRelation: formData.GuardianRelation,
      GuardianQualification: formData.GuardianQualification,
      GuardianOccupation: formData.GuardianOccupation,
      GuardianDesignation: formData.GuardianDesignation,
      GuardianDepartment: formData.GuardianDepartment,
      GuardianOfficeAddress: formData.GuardianOfficeAddress,
      GuardianContactNo: formData.GuardianContactNo,

      AdmissionCategory: formData.AdmissionCategory,
      AdmissionClass: formData.AdmissionClass,
      StudentHeight: formData.StudentHeight ? Number(formData.StudentHeight) : null,
      StudentWeight: formData.StudentWeight ? Number(formData.StudentWeight) : null,
      SamagraId: formData.SamagraId,
      ChildId: formData.ChildId,
      PEN: formData.PEN,
      // Address: permanent copies home address when "same as home" is ticked
      presentCity: formData.presentCity || null,
      presentPin: formData.presentPin || null,
      permanentAddress: (formData.isSameAddress ? formData.presentAddress : formData.permanentAddress) || null,
      permanentCity: (formData.isSameAddress ? formData.presentCity : formData.permanentCity_ui) || null,
      permanentPin: (formData.isSameAddress ? formData.presentPin : formData.permanentPin) || null,
      previousSchoolName: formData.previousSchoolName,
      primaryIncomePerYear: formData.primaryIncomePerYear ? Number(formData.primaryIncomePerYear) : null,
      secondaryIncomePerYear: formData.secondaryIncomePerYear ? Number(formData.secondaryIncomePerYear) : null,
      primaryOfficeAddress: formData.primaryOfficeAddress,
      secondaryOfficeAddress: formData.secondaryOfficeAddress,
      Hobbies: formData.Hobbies,
      SecondLanguage: formData.SecondLanguage,
      ThirdLanguage: formData.ThirdLanguage,
      GroupUniqueId: formData.GroupUniqueId,
      serviceNumber: formData.serviceNumber,
      EmploymentservingStatus: formData.EmploymentservingStatus,
      StudentStatus: formData.StudentStatus,
      ApaarId: formData.ApaarId,
      Stream: formData.Stream,
      location: formData.location,
      branch: formData.branch,
      academic_year: formData.academic_year,
      photos: {
        student: studentPhoto,
        father: fatherPhoto,
        mother: motherPhoto,
        guardian: guardianPhoto,
      },
      documents: checkedDocuments,
      feeInstallments: formData.feeInstallments,
      // Previous School Details Mapped to Backend
      SchoolName: formData.SchoolName,
      PreviousSchoolClass: formData.PreviousSchoolClass,
      TCNumber: formData.TCNumber,
      AdmissionNumber: formData.PreviousAdmissionNumber, // Map to backend AdmissionNumber (distinct from admission_no)
    };
  };

  const handleSaveClick = async (exit: boolean) => {
    if (
      mode === "create" &&
      firstStepWithError(findErrors(formData)) !== null
    ) {
      // Same check as always; now we also take the person to the first step with a problem.
      const firstBad = firstStepWithError(findErrors(formData));
      if (firstBad !== null) {
        goToStep(firstBad);
        setAttemptedSteps(prev => ({ ...prev, [firstBad]: true }));
      }
      notify.warning("Some details are missing. Fix the fields marked in red.");
      return;
    }

    const payload = buildPayload();

    setSaving(true);
    try {
      if (mode === "create") {
        const res = await api.post(`/students`, payload);
        const studentId = res.data?.student_id;

        if (!studentId) {
          throw new Error('Student created but student ID was not returned.');
        }

        let uploadProblem: string | undefined;
        if (pendingDocuments.length > 0) {
          try {
            await uploadPendingDocuments(studentId);
            notify("Student created and documents uploaded successfully!");
          } catch (uploadError: any) {
            console.error('Document upload error:', uploadError);
            uploadProblem = uploadError.message;
            notify(
              `Student created successfully, but document upload failed: ${uploadError.message}`
            );
          }
        } else {
          notify("Student created successfully!");
        }

        // Show the "Student saved" screen; onSave(res.data, exit) is called when the person leaves it.
        void exit;
        lastSavedRef.current = res.data;
        setSavedStudent({
          data: res.data,
          name: [formData.first_name, formData.last_name].filter(Boolean).join(" "),
          classLabel: [formData.class, formData.section].filter(Boolean).join(" - "),
          uploadProblem,
        });
        requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

      } else if (mode === "edit") {
        const id = studentData?.student_id || studentData?.id;
        if (!id) {
          notify("Error: Student ID is missing for update.");
          return;
        }

        const res = await api.put(`/students/${id}`, payload);

        if (pendingDocuments.length > 0) {
          try {
            await uploadPendingDocuments(id);
            notify("Student updated and documents uploaded successfully!");
          } catch (uploadError: any) {
            console.error('Document upload error:', uploadError);
            notify(
              `Student updated successfully, but document upload failed: ${uploadError.message}`
            );
          }
        } else {
          notify("Student updated successfully!");
        }

        // 🔥 IMPORTANT: use backend response
        if (onSave) onSave(res.data.student, exit);
      }

    } catch (error: any) {
      console.error("Error saving student:", error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || "Failed to save student";
      notify(`Failed to save student: ${errorMsg}`);
    } finally {
      setSaving(false);
    }

  };


  // ------------------------------------------------------------------ UI
  const formCtx: AdmissionFormCtx = {
    data: formData,
    onChange: handleInputChange,
    errorFor: (name) => {
      const rule = REQUIRED_FIELDS[name];
      if (!rule || !errors[name]) return undefined;
      return attemptedSteps[rule.step] || touched[name] ? errors[name] : undefined;
    },
    onBlur: (name) => setTouched(prev => (prev[name] ? prev : { ...prev, [name]: true })),
    isRequired: (name) => !!REQUIRED_FIELDS[name],
  };

  const historyColumns: Column<any>[] = [
    { key: "academic_year", header: "Academic year", primary: true },
    { key: "class", header: "Class", secondary: true, render: (r) => [r.class, r.section].filter(Boolean).join(" - ") || "-" },
    { key: "roll_no", header: "Roll number", render: (r) => r.roll_no || "-" },
    {
      key: "is_promoted", header: "Status",
      render: (r) => (r.is_promoted ? <span className="badge-success">Promoted</span> : <span className="badge-neutral">Enrolled</span>),
    },
    {
      key: "date", header: "Date",
      render: (r) => (r.promoted_date ? new Date(r.promoted_date).toLocaleDateString() : r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"),
    },
  ];

  const historySection = (mode === "view" || mode === "edit") && academicHistory.length > 0 && (
    <section className="card">
      <div className="card-header"><h3 className="text-base font-semibold text-slate-900">Class history</h3></div>
      <div className="card-body">
        <DataList columns={historyColumns} rows={academicHistory} rowKey={(r, i) => r.id ?? i} />
      </div>
    </section>
  );

  // ---------- View mode: a readable summary ----------
  if (isViewMode) {
    return (
      <div ref={topRef} className="p-4 md:p-6 bg-surface-muted min-h-full">
        <div className="w-full max-w-[1600px] mx-auto space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Student details</h2>
          <AdmissionSummary data={formData} photo={studentPhoto} />
          {historySection}
          <ActionBar>
            <Button variant="secondary" onClick={onCancel} icon={<ArrowLeft className="w-4 h-4" />}>Back</Button>
            {onEdit && <Button onClick={onEdit} icon={<Pencil className="w-4 h-4" />}>Edit student</Button>}
          </ActionBar>
        </div>
      </div>
    );
  }

  // ---------- After a new student is saved ----------
  if (savedStudent) {
    const admissionNo = savedStudent.data?.admission_no || savedStudent.data?.student?.admission_no;
    return (
      <div ref={topRef} className="p-4 md:p-6 bg-surface-muted min-h-full">
        <div className="w-full max-w-[1600px] mx-auto card card-body text-center py-10 space-y-4">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" aria-hidden="true" />
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Student saved</h2>
            <p className="mt-1 text-slate-600">
              {savedStudent.name || "The student"} has been added{savedStudent.classLabel ? ` to Class ${savedStudent.classLabel}` : ""}.
            </p>
            {admissionNo && <p className="mt-1 text-sm text-slate-500">Admission number: <span className="font-semibold text-slate-800">{admissionNo}</span></p>}
          </div>
          {savedStudent.uploadProblem && (
            <Alert tone="warning" title="Some documents did not upload" className="text-left">
              {savedStudent.uploadProblem}. You can add them later from the student's documents.
            </Alert>
          )}
          <div className="flex flex-col gap-2 pt-2">
            <Button size="lg" onClick={addAnother} icon={<UserPlus className="w-5 h-5" />}>Add another student</Button>
            {navigateTo && (
              <Button size="lg" variant="secondary" onClick={() => navigateTo("take-fee")} icon={<Wallet className="w-5 h-5" />}>
                Collect fee for this student
              </Button>
            )}
            <Button variant="ghost" onClick={leave} icon={<ArrowLeft className="w-4 h-4" />}>Back to students</Button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Create / edit: guided steps ----------
  const isReview = step === REVIEW_STEP;
  const fullName = [formData.first_name, formData.last_name].filter(Boolean).join(" ");
  const classLabel = [formData.class, formData.section].filter(Boolean).join("-");
  const phoneProps = { type: "tel", inputMode: "tel" as const, placeholder: "+91 98765 43210", autoComplete: "tel" };

  const note = !isReview ? (
    stepErrors.length > 0 ? (
      <span>
        Still needed: {stepErrors.map(n => (LABELS[n] || n).toLowerCase()).join(", ")}.{" "}
        <button type="button" className="font-semibold text-brand-700 underline underline-offset-2" onClick={() => showStepProblems(step)}>
          Show me
        </button>
      </span>
    ) : mode === "edit" ? "You can save now, or go on to check the other steps." : null
  ) : mode === "create" ? (
    <span>
      You are adding <b>{fullName || "this student"}</b>{classLabel ? <> to Class <b>{classLabel}</b></> : null}
      {pendingDocuments.length > 0 ? ` with ${pendingDocuments.length} document${pendingDocuments.length > 1 ? "s" : ""}` : ""}.
    </span>
  ) : (
    "Changes are saved only when you press Save changes."
  );

  return (
    <div ref={topRef} className="p-4 md:p-6 bg-surface-muted min-h-full">
      {/* Desktop: steps on the left, form in the middle, live summary on the right. Phones: form only. */}
      <div className="mx-auto max-w-[1600px] grid grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_320px] gap-5 items-start">
      <div className="hidden lg:block">
        <StepRail step={step} errors={errors} onJump={goToStep} />
      </div>
      <form ref={formRef} id="create-student-form" onSubmit={(e) => e.preventDefault()} className="min-w-0" noValidate>
        <AdmissionFormContext.Provider value={formCtx}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-base font-semibold text-brand-700">{mode === "create" ? "Add a new student" : "Edit student"}</h2>
            <button type="button" onClick={handleResetClick} className="btn-ghost btn-sm min-h-[44px] text-slate-600">
              Clear form
            </button>
          </div>
          <Steps steps={[...ADMISSION_STEPS]} current={step} onJump={goToStep} className="mb-5 lg:[&_ol]:hidden" />

          <div className="space-y-4">
            {/* ---------------- Step 1: Student ---------------- */}
            {step === 0 && (
              <>
                <Group title="About the student">
                  <div className="sm:col-span-2">
                    <PhotoPicker id="student-photo" label="Student photo (optional)" photo={studentPhoto} onChange={(e) => handlePhotoChange(e, setStudentPhoto)} />
                  </div>
                  <TextField name="first_name" label={LABELS.first_name} autoComplete="off" />
                  <TextField name="last_name" label={LABELS.last_name} autoComplete="off" />
                  <ChoiceField name="gender" label={LABELS.gender} options={["Male", "Female"]} className="sm:col-span-2" />
                  <TextField name="dob" label={LABELS.dob} type="date" />
                  <TextField name="admission_date" label={LABELS.admission_date} type="date" hint="Today's date is filled in. Change it if needed." />
                  <TextField name="Adharcardno" label={LABELS.Adharcardno} inputMode="numeric" placeholder="1234-5678-9012" hint="12 digits" className="sm:col-span-2" />
                </Group>
                <MoreDetails title="More details (optional)" names={STUDENT_MORE}>
                  <TextField name="email" label={LABELS.email} type="email" inputMode="email" />
                  <TextField name="BloodGroup" label={LABELS.BloodGroup} placeholder="e.g. B+" />
                  <TextField name="Religion" label={LABELS.Religion} />
                  <TextField name="MotherTongue" label={LABELS.MotherTongue} />
                  <TextField name="Caste" label={LABELS.Caste} />
                  <TextField name="Category" label={LABELS.Category} />
                  <TextField name="House" label={LABELS.House} />
                  <TextField name="StudentHeight" label={LABELS.StudentHeight} type="number" inputMode="decimal" />
                  <TextField name="StudentWeight" label={LABELS.StudentWeight} type="number" inputMode="decimal" />
                  <TextField name="SamagraId" label={LABELS.SamagraId} />
                  <TextField name="ChildId" label={LABELS.ChildId} />
                  <TextField name="PEN" label={LABELS.PEN} />
                </MoreDetails>
              </>
            )}

            {/* ---------------- Step 2: Parents ---------------- */}
            {step === 1 && (
              <>
                <Group title="Father">
                  <TextField name="Fatherfirstname" label={LABELS.Fatherfirstname} autoComplete="off" />
                  <TextField name="FatherPhone" label={LABELS.FatherPhone} {...phoneProps} />
                </Group>
                <Group title="Mother">
                  <TextField name="Motherfirstname" label={LABELS.Motherfirstname} autoComplete="off" />
                  <TextField name="SecondaryPhone" label={`${LABELS.SecondaryPhone} (optional)`} {...phoneProps} />
                </Group>
                <Group title="Numbers the school will use">
                  <TextField
                    name="phone"
                    label={LABELS.phone}
                    hint="The school calls this number about the student."
                    disabled={sameAsFather.phone}
                    {...phoneProps}
                    extra={
                      <Toggle id="phone-same-as-father" label="Same as father's phone" checked={sameAsFather.phone}
                        onChange={(v) => setSameAsFather((p) => ({ ...p, phone: v }))} />
                    }
                  />
                  <TextField
                    name="SmsNo"
                    label={`${LABELS.SmsNo} (optional)`}
                    hint="School messages are sent to this number."
                    disabled={sameAsFather.SmsNo}
                    {...phoneProps}
                    extra={
                      <Toggle id="sms-same-as-father" label="Same as father's phone" checked={sameAsFather.SmsNo}
                        onChange={(v) => setSameAsFather((p) => ({ ...p, SmsNo: v }))} />
                    }
                  />
                </Group>
                <MoreDetails title="More about the father (optional)" names={FATHER_MORE}>
                  <TextField name="FatherEmail" label={LABELS.FatherEmail} type="email" inputMode="email" />
                  <TextField name="PrimaryQualification" label={LABELS.PrimaryQualification} />
                  <TextField name="FatherOccuption" label={LABELS.FatherOccuption} />
                  <TextField name="FatherCompany" label={LABELS.FatherCompany} />
                  <TextField name="FatherDesignation" label={LABELS.FatherDesignation} />
                  <TextField name="FatherAadhar" label={LABELS.FatherAadhar} inputMode="numeric" placeholder="1234-5678-9012" />
                </MoreDetails>
                <MoreDetails title="More about the mother (optional)" names={MOTHER_MORE}>
                  <TextField name="SecondaryEmail" label={LABELS.SecondaryEmail} type="email" inputMode="email" />
                  <TextField name="SecondaryQualification" label={LABELS.SecondaryQualification} />
                  <TextField name="SecondaryOccupation" label={LABELS.SecondaryOccupation} />
                  <TextField name="SecondaryCompany" label={LABELS.SecondaryCompany} />
                  <TextField name="SecondaryDesignation" label={LABELS.SecondaryDesignation} />
                  <TextField name="MotherAadhar" label={LABELS.MotherAadhar} inputMode="numeric" placeholder="1234-5678-9012" />
                </MoreDetails>
                <MoreDetails title="Guardian (optional)" names={GUARDIAN}>
                  <p className="sm:col-span-2 text-sm text-slate-500">Fill this only if someone other than the parents looks after the student.</p>
                  <TextField name="GuardianName" label={LABELS.GuardianName} />
                  <TextField name="GuardianRelation" label={LABELS.GuardianRelation} placeholder="e.g. Uncle" />
                  <TextField name="GuardianContactNo" label={LABELS.GuardianContactNo} {...phoneProps} />
                  <TextField name="GuardianQualification" label={LABELS.GuardianQualification} />
                  <TextField name="GuardianOccupation" label={LABELS.GuardianOccupation} />
                  <TextField name="GuardianOfficeAddress" label={LABELS.GuardianOfficeAddress} />
                </MoreDetails>
              </>
            )}

            {/* ---------------- Step 3: Address ---------------- */}
            {step === 2 && (
              <>
                <Group title="Where does the student live?">
                  <TextField name="presentAddress" label={`${LABELS.presentAddress} (optional)`} multiline className="sm:col-span-2" />
                  <TextField name="presentCity" label={LABELS.presentCity} />
                  <TextField name="presentPin" label={LABELS.presentPin} inputMode="numeric" placeholder="6 digits" />
                </Group>
                <Group title="Permanent address">
                  <CheckField name="isSameAddress" label="Permanent address is the same as home address" className="sm:col-span-2" />
                  {!formData.isSameAddress && (
                    <>
                      <TextField name="permanentAddress" label={LABELS.permanentAddress} multiline className="sm:col-span-2" />
                      <TextField name="permanentCity_ui" label={LABELS.permanentCity_ui} />
                    </>
                  )}
                </Group>
              </>
            )}

            {/* ---------------- Step 4: Class & admission ---------------- */}
            {step === 3 && (
              <>
                <Group title="Branch and year">
                  {canSelectBranch ? (
                    <SelectField name="branch" label={LABELS.branch} options={branchOptions.map((b) => b.branch_name)} />
                  ) : (
                    <ReadOnlyField name="branch" label={LABELS.branch} value={formData.branch} />
                  )}
                  {canSelectLocation ? (
                    <SelectField name="location" label={LABELS.location} options={locationOptions.map((l) => ({ value: l.name, label: l.name }))} />
                  ) : (
                    <ReadOnlyField name="location" label={LABELS.location} value={formData.location} />
                  )}
                  <ReadOnlyField
                    name="academic_year"
                    label={LABELS.academic_year}
                    value={academicYearOptions.find((y) => y.name === formData.academic_year)?.name || formData.academic_year}
                  />
                </Group>
                <Group title="Class">
                  <SelectField name="class" label={LABELS.class} options={classList} />
                  <SelectField
                    name="section"
                    label={LABELS.section}
                    options={sectionList}
                    disabled={!formData.class}
                    hint={!formData.class ? "Choose a class first" : sectionList.length === 0 ? "No sections found for this class." : undefined}
                  />
                  <ChoiceField
                    name="AdmissionCategory"
                    label={LABELS.AdmissionCategory}
                    options={[{ value: "Regular", label: "Regular" }, { value: "Day-Scholar", label: "Day scholar" }]}
                    className="sm:col-span-2"
                  />
                  <TextField
                    name="AdmissionClass"
                    label={LABELS.AdmissionClass}
                    disabled={admissionClassLocked}
                    hint={admissionClassLocked ? "This cannot be changed." : "The class the student first joined in."}
                    extra={
                      !admissionClassLocked && formData.class && formData.AdmissionClass !== formData.class ? (
                        <button
                          type="button"
                          className="btn-ghost btn-sm mt-1 min-h-[44px] text-brand-700"
                          onClick={() => setFormData((prev) => ({ ...prev, AdmissionClass: prev.class }))}
                        >
                          Same as class {formData.class}
                        </button>
                      ) : null
                    }
                  />
                  <TextField name="StudentType" label={`${LABELS.StudentType} (optional)`} />
                  <TextField name="enrollment_no" label={`${LABELS.enrollment_no} (optional)`} />
                  <ReadOnlyField label={LABELS.admissionNo} value={formData.admissionNo} placeholder="Given automatically when you save" />
                </Group>
                <MoreDetails title="Previous school (optional)" names={PREVIOUS_SCHOOL}>
                  <TextField name="SchoolName" label={LABELS.SchoolName} />
                  <TextField name="PreviousSchoolClass" label={LABELS.PreviousSchoolClass} />
                  <TextField name="TCNumber" label={LABELS.TCNumber} />
                  <TextField name="PreviousAdmissionNumber" label={LABELS.PreviousAdmissionNumber} />
                </MoreDetails>
                {historySection}
              </>
            )}

            {/* ---------------- Step 5: Check, documents & save ---------------- */}
            {isReview && (
              <>
                <Alert tone="info">Check the details below. Tap <b>Edit</b> to change anything.</Alert>
                <AdmissionSummary data={formData} photo={studentPhoto} onEdit={goToStep} errors={errors} />
                <AdmissionDocuments
                  documentTypes={documentTypes}
                  docTypeId={selectedDocTypeId}
                  onDocTypeId={setSelectedDocTypeId}
                  docNo={selectedDocNo}
                  onDocNo={setSelectedDocNo}
                  docFile={selectedDocFile}
                  onDocFile={handleDocumentFileChange}
                  onAdd={handleAddPendingDocument}
                  pending={pendingDocuments}
                  onRemove={removePendingDocument}
                  error={documentUploadError}
                  success={documentUploadSuccess}
                  fileInputKey={pendingDocuments.length}
                />
              </>
            )}
          </div>

          <ActionBar note={note}>
            <Button variant="secondary" onClick={handleBack} disabled={saving}>
              {step === 0 ? "Cancel" : "Back"}
            </Button>
            {mode === "edit" && !isReview && (
              <Button variant="soft" onClick={() => handleSaveClick(true)} loading={saving}>
                Save changes
              </Button>
            )}
            {!isReview ? (
              <Button onClick={handleNext} disabled={stepErrors.length > 0}>
                Next
              </Button>
            ) : (
              <Button variant="success" onClick={() => handleSaveClick(true)} loading={saving} icon={<CheckCircle2 className="w-4 h-4" />}>
                {mode === "create" ? "Save student" : "Save changes"}
              </Button>
            )}
          </ActionBar>
        </AdmissionFormContext.Provider>
      </form>
      <div className="hidden xl:block">
        <LiveSummary data={formData} photo={studentPhoto} errors={errors} documents={pendingDocuments.length} mode={mode} />
      </div>
      </div>
    </div>
  );
};

export default CreateStudent;
