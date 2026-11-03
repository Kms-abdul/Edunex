/**
 * Step layout, plain-words labels and required-field rules for the
 * "Add a new student" flow. The required list is exactly the one the
 * save button has always checked (create mode only); here it is just
 * grouped by step so each step can show its own messages.
 */

export const ADMISSION_STEPS = ['Student details', 'Parents and phone', 'Address', 'Class and admission', 'Check and save'] as const;
export const REVIEW_STEP = ADMISSION_STEPS.length - 1;

/** field name -> step index + what to do when it is empty */
export const REQUIRED_FIELDS: Record<string, { step: number; message: string }> = {
  first_name: { step: 0, message: 'Enter the first name' },
  last_name: { step: 0, message: 'Enter the last name' },
  gender: { step: 0, message: 'Choose male or female' },
  dob: { step: 0, message: 'Enter the date of birth' },
  Adharcardno: { step: 0, message: 'Enter the Aadhaar number' },
  admission_date: { step: 0, message: 'Enter the admission date' },
  Fatherfirstname: { step: 1, message: "Enter the father's name" },
  FatherPhone: { step: 1, message: "Enter the father's phone number" },
  Motherfirstname: { step: 1, message: "Enter the mother's name" },
  phone: { step: 1, message: 'Enter a main phone number' },
  branch: { step: 3, message: 'Choose a branch' },
  academic_year: { step: 3, message: 'No academic year is set. Choose the year at the top of the app.' },
  class: { step: 3, message: 'Choose a class' },
  section: { step: 3, message: 'Choose a section' },
  AdmissionCategory: { step: 3, message: 'Choose the admission type' },
  AdmissionClass: { step: 3, message: 'Enter the class the student joined in' },
};

/** Same rule as before: a required value must not be empty. */
export const findErrors = (data: Record<string, any>): Record<string, string> => {
  const errors: Record<string, string> = {};
  Object.entries(REQUIRED_FIELDS).forEach(([name, rule]) => {
    if (!data[name]) errors[name] = rule.message;
  });
  return errors;
};

export const errorsInStep = (errors: Record<string, string>, step: number) =>
  Object.keys(errors).filter(name => REQUIRED_FIELDS[name]?.step === step);

export const firstStepWithError = (errors: Record<string, string>): number | null => {
  const steps = Object.keys(errors).map(n => REQUIRED_FIELDS[n]?.step ?? 0);
  return steps.length ? Math.min(...steps) : null;
};

/** Plain-words labels, shared by the form and the summary. */
export const LABELS: Record<string, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  gender: 'Gender',
  dob: 'Date of birth',
  admission_date: 'Admission date',
  Adharcardno: 'Aadhaar number',
  email: 'Student email',
  BloodGroup: 'Blood group',
  Religion: 'Religion',
  MotherTongue: 'Mother tongue',
  Caste: 'Caste',
  Category: 'Category',
  House: 'House',
  StudentHeight: 'Height (cm)',
  StudentWeight: 'Weight (kg)',
  SamagraId: 'Samagra ID',
  ChildId: 'Child ID',
  PEN: 'PEN number',

  Fatherfirstname: "Father's name",
  FatherPhone: "Father's phone number",
  FatherEmail: "Father's email",
  PrimaryQualification: "Father's education",
  FatherOccuption: "Father's work",
  FatherCompany: "Father's company",
  FatherDesignation: "Father's job title",
  FatherAadhar: "Father's Aadhaar number",
  Motherfirstname: "Mother's name",
  SecondaryPhone: "Mother's phone number",
  SecondaryEmail: "Mother's email",
  SecondaryQualification: "Mother's education",
  SecondaryOccupation: "Mother's work",
  SecondaryCompany: "Mother's company",
  SecondaryDesignation: "Mother's job title",
  MotherAadhar: "Mother's Aadhaar number",
  phone: 'Main phone number',
  SmsNo: 'Number for SMS',
  GuardianName: "Guardian's name",
  GuardianRelation: 'Relation to student',
  GuardianContactNo: "Guardian's phone number",
  GuardianQualification: "Guardian's education",
  GuardianOccupation: "Guardian's work",
  GuardianOfficeAddress: "Guardian's office address",

  presentAddress: 'Home address',
  presentCity: 'City or town',
  presentPin: 'PIN code',
  permanentAddress: 'Permanent address',
  permanentCity_ui: 'Permanent city or town',

  branch: 'Branch',
  location: 'Location',
  academic_year: 'Academic year',
  class: 'Class',
  section: 'Section',
  AdmissionCategory: 'Admission type',
  AdmissionClass: 'Class at admission',
  StudentType: 'Student type',
  enrollment_no: 'Enrollment number',
  admissionNo: 'Admission number',
  SchoolName: 'Previous school name',
  PreviousSchoolClass: 'Class in previous school',
  TCNumber: 'TC number',
  PreviousAdmissionNumber: 'Admission number in previous school',
};

export const STUDENT_MORE = ['email', 'BloodGroup', 'Religion', 'MotherTongue', 'Caste', 'Category', 'House', 'StudentHeight', 'StudentWeight', 'SamagraId', 'ChildId', 'PEN'];
export const FATHER_MORE = ['FatherEmail', 'PrimaryQualification', 'FatherOccuption', 'FatherCompany', 'FatherDesignation', 'FatherAadhar'];
export const MOTHER_MORE = ['SecondaryEmail', 'SecondaryQualification', 'SecondaryOccupation', 'SecondaryCompany', 'SecondaryDesignation', 'MotherAadhar'];
export const GUARDIAN = ['GuardianName', 'GuardianRelation', 'GuardianContactNo', 'GuardianQualification', 'GuardianOccupation', 'GuardianOfficeAddress'];
export const PREVIOUS_SCHOOL = ['SchoolName', 'PreviousSchoolClass', 'TCNumber', 'PreviousAdmissionNumber'];

/** What the summary shows per step: main fields always, the rest only when filled. */
export const SUMMARY: { step: number; title: string; main: string[]; extra: string[] }[] = [
  { step: 0, title: 'Student', main: ['first_name', 'last_name', 'gender', 'dob', 'Adharcardno', 'admission_date'], extra: STUDENT_MORE },
  { step: 1, title: 'Parents and phone', main: ['Fatherfirstname', 'FatherPhone', 'Motherfirstname', 'SecondaryPhone', 'phone', 'SmsNo'], extra: [...FATHER_MORE, ...MOTHER_MORE, ...GUARDIAN] },
  { step: 2, title: 'Address', main: ['presentAddress', 'presentCity', 'presentPin'], extra: ['permanentAddress', 'permanentCity_ui'] },
  { step: 3, title: 'Class and admission', main: ['branch', 'location', 'academic_year', 'class', 'section', 'AdmissionCategory', 'AdmissionClass'], extra: ['StudentType', 'enrollment_no', 'admissionNo', ...PREVIOUS_SCHOOL] },
];

/** Phone values are stored as "+91 " + digits; treat a bare prefix as nothing typed for display. */
export const displayValue = (v: any): string => {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  if (s === '+91') return '';
  return s;
};
