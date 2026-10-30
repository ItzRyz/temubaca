"use client";

import { useEffect, useRef } from "react";

import { markLoansSeen } from "../actions";

/** Clears the "kabar baru" dot after the reader opened what they borrow; rendering stays free of side effects. */
export function MarkLoansSeen() {
    const sent = useRef(false);
    useEffect(() => {
        if (sent.current) return;
        sent.current = true;
        void markLoansSeen();
    }, []);
    return null;
}
