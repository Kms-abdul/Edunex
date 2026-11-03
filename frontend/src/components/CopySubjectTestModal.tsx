import { useEffect, useState } from "react";
import api from "../api";
import { notify, confirmDialog } from './ui/feedback';
import { LoadingState, EmptyState, Alert, Field } from './ui';
import { SetupSheet, Choice } from './exam-setup/shared';

interface CopySubjectTestModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceClassTestId: number | null;
    currentAcademicYear: string;
    currentBranch: string; // Branch ID or 'All'
    currentClass: string; // Class ID
    currentTest: string; // Test ID
} 
  
interface Option {
    id: string | number;
    label: string;
}

export default function CopySubjectTestModal({
    isOpen,
    onClose,
    sourceClassTestId,
    currentAcademicYear,
    currentBranch,
    currentClass,
    currentTest
}: CopySubjectTestModalProps) {
    const [copyMode, setCopyMode] = useState<"test_to_test" | "class_to_class" | "branch_to_branch">("test_to_test");
    const [options, setOptions] = useState<Option[]>([]);
    const [selectedTargets, setSelectedTargets] = useState<(string | number)[]>([]);
    const [loading, setLoading] = useState(false);
    const [copying, setCopying] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchOptions();
            setSelectedTargets([]);
        }
    }, [isOpen, copyMode]);

    const fetchOptions = async () => {
        setLoading(true);
        try {
            let data: Option[] = [];

            if (copyMode === "test_to_test") {
                // Fetch Tests for current context
                const res = await api.get("/test-types", {
                    params: { academic_year: currentAcademicYear }
                });
                // Filter out current test
                data = res.data
                    .filter((t: any) => String(t.id) !== String(currentTest))
                    .map((t: any) => ({
                        id: t.id,
                        label: t.test_name
                    }));
            } else if (copyMode === "class_to_class") {
                // Fetch Classes
                // Note: API for classes usually returns all, we might filter if needed but generally all classes are valid targets
                const res = await api.get("/classes", {
                    headers: { "X-Academic-Year": currentAcademicYear }
                });
                data = res.data.classes
                    .filter((c: any) => String(c.id) !== String(currentClass))
                    .map((c: any) => ({
                        id: c.id,
                        label: c.class_name
                    }));

            } else if (copyMode === "branch_to_branch") {
                // Fetch Branches
                const res = await api.get("/branches");
                data = res.data.branches
                    .filter((b: any) => String(b.id) !== String(currentBranch))
                    .map((b: any) => ({
                        id: b.id,
                        label: b.branch_name
                    }));
            }

            setOptions(data);
        } catch (err) {
            console.error("Failed to fetch copy targets", err);
            notify.error("Could not load the list. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (id: string | number) => {
        setSelectedTargets(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleCopy = async () => {
        if (!sourceClassTestId) return;
        if (selectedTargets.length === 0) {
            notify("Choose at least one to copy to.");
            return;
        }

        if (!await confirmDialog(`Copy these subjects to ${selectedTargets.length} more? What is already set there will be replaced.`)) {
            return;
        }

        setCopying(true);
        try {
            await api.post("/class-test-subjects/copy", {
                source_class_test_id: sourceClassTestId,
                copy_mode: copyMode,
                target_ids: selectedTargets,
                current_academic_year: currentAcademicYear,
                current_branch: currentBranch,
                current_class: currentClass,
                current_test: currentTest
            });
            notify.success("Subjects copied");
            onClose();
        } catch (err: any) {
            notify.error(err.response?.data?.error || "Could not copy. Please try again.");
        } finally {
            setCopying(false);
        }
    };

    if (!isOpen) return null;

    const n = selectedTargets.length;
    const modeWord = copyMode === "test_to_test" ? "exam" : copyMode === "class_to_class" ? "class" : "branch";
    const plural = (w: string, c: number) => c === 1 ? w : (w === "class" ? "classes" : w === "branch" ? "branches" : `${w}s`);

    return (
        <SetupSheet
            open={isOpen}
            onClose={onClose}
            title="Copy these subjects"
            subtitle="Give other exams, classes or branches the same subjects and marks."
            footer={<>
                <button type="button" onClick={onClose} className="btn-secondary">
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleCopy}
                    disabled={copying || n === 0}
                    className="btn-primary"
                >
                    {copying ? "Copying…" : n === 0 ? `Choose ${modeWord === "exam" ? "an" : "a"} ${modeWord}` : `Copy to ${n} ${plural(modeWord, n)}`}
                </button>
            </>}
        >
            {/* Mode Selection */}
            <Field label="Copy to" className="mb-4">
                <Choice
                    label="Copy to"
                    value={copyMode}
                    onChange={setCopyMode}
                    options={[
                        { value: "test_to_test", label: "Other exams" },
                        { value: "class_to_class", label: "Other classes" },
                        { value: "branch_to_branch", label: "Other branches" },
                    ]}
                />
                <p className="mt-1.5 text-sm text-slate-500">
                    {copyMode === "test_to_test" && "Same class and branch, different exams."}
                    {copyMode === "class_to_class" && "Same exam and branch, different classes."}
                    {copyMode === "branch_to_branch" && "Same exam and class, different branches."}
                </p>
            </Field>

            <Alert tone="warning" className="mb-4">
                What is already set there will be replaced.
            </Alert>

            {/* Target Selection */}
            {loading ? (
                <LoadingState label="Loading…" className="py-6" />
            ) : options.length === 0 ? (
                <EmptyState compact title={`No other ${plural(modeWord, 2)} found`} />
            ) : (
                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                    <label className="flex items-center gap-3 px-3 min-h-[48px] cursor-pointer bg-slate-50 hover:bg-slate-100">
                        <input
                            type="checkbox"
                            className="w-5 h-5 accent-brand-600"
                            checked={selectedTargets.length === options.length}
                            onChange={(e) => {
                                if (e.target.checked) setSelectedTargets(options.map(o => o.id));
                                else setSelectedTargets([]);
                            }}
                        />
                        <span className="font-semibold text-slate-800">Choose all</span>
                    </label>
                    {options.map(opt => (
                        <label key={opt.id} className="flex items-center gap-3 px-3 min-h-[48px] cursor-pointer hover:bg-slate-50 active:bg-slate-100">
                            <input
                                type="checkbox"
                                className="w-5 h-5 accent-brand-600"
                                checked={selectedTargets.includes(opt.id)}
                                onChange={() => handleToggle(opt.id)}
                            />
                            <span className="text-[15px] text-slate-800">{opt.label}</span>
                        </label>
                    ))}
                </div>
            )}
        </SetupSheet>
    );
}
