/* Groups consecutive installments of the same fee type into one receipt line.
   Moved verbatim from TakeFee.tsx (used for receipts and payment history). */


export const groupInstallments = (items: any[]) => {
    const installmentFees = items.filter(i => i.installment && i.installment !== "One-Time" && i.installment !== "None");
    const otherFees = items.filter(i => !i.installment || i.installment === "One-Time" || i.installment === "None");

    const groups: any[] = [];

    const byType: Record<string, any[]> = {};
    installmentFees.forEach(i => {
        const type = i.fee_type || "Tuition Fee";
        if (!byType[type]) byType[type] = [];
        byType[type].push(i);
    });

    Object.keys(byType).forEach(type => {
        const sorted = byType[type].sort((a, b) => (a.sr || 0) - (b.sr || 0));
        if (sorted.length === 0) return;

        let currentGroup = [sorted[0]];

        for (let i = 1; i < sorted.length; i++) {
            const prev = currentGroup[currentGroup.length - 1];
            const curr = sorted[i];
            const prevSr = prev.sr || 0;
            const currSr = curr.sr || 0;

            if (prevSr > 0 && currSr > 0 && currSr === prevSr + 1) {
                currentGroup.push(curr);
            } else {
                groups.push(createGroupedItem(type, currentGroup));
                currentGroup = [curr];
            }
        }
        if (currentGroup.length > 0) {
            groups.push(createGroupedItem(type, currentGroup));
        }
    });

    otherFees.forEach(f => {
        const paid = parseFloat(f.amount_paid || f.paid || 0);
        const due = parseFloat(f.due_amount || f.due || 0);
        const concession = parseFloat(f.concession_amount || f.concession || 0);
        const gross = parseFloat(f.gross_amount || f.amount || 0) || (paid + due + concession);
        groups.push({
            title: f.fee_type === "General" ? "One-Time Fee" : f.fee_type,
            amount: gross,
            amount_paid: paid,
            paid: paid,
            concession: concession,
            payable: gross,
            due_amount: due,
            due: due,
            originalItems: [f]
        });
    });

    return groups;
};

const createGroupedItem = (type: string, items: any[]) => {
    const start = (items[0].installment || items[0].title || "").replace(" Fee", "");
    const end = (items[items.length - 1].installment || items[items.length - 1].title || "").replace(" Fee", "");

    let title = `${type} - ${start} Fee`;
    if (items.length > 1) {
        title = `Payment for ${start} Fee to ${end} Fee`;
    }

    const totalPaid = items.reduce((sum: number, i: any) => sum + parseFloat(i.amount_paid || i.paid || 0), 0);
    const totalConcession = items.reduce((sum: number, i: any) => sum + parseFloat(i.concession_amount || i.concession || 0), 0);
    const totalDue = items.reduce((sum: number, i: any) => sum + parseFloat(i.due_amount || i.due || 0), 0);
    const totalGross = items.reduce((sum: number, i: any) => sum + parseFloat(i.gross_amount || i.amount || 0), 0) || (totalPaid + totalDue + totalConcession);

    return {
        title,
        amount: totalGross,
        amount_paid: totalPaid,
        paid: totalPaid,
        concession: totalConcession,
        payable: totalGross,
        due_amount: totalDue,
        due: totalDue,
        originalItems: items
    };
};
