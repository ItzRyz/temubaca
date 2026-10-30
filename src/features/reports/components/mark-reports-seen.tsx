"use client";

import { useEffect, useRef } from "react";

import { markReportsSeen } from "../actions";

/** Clears the "Laporan saya" dot after the page is open; rendering stays free of side effects. */
export function MarkReportsSeen() {
    const sent = useRef(false);
    useEffect(() => {
        if (sent.current) return;
        sent.current = true;
        void markReportsSeen();
    }, []);
    return null;
}
