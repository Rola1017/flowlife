"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { LS_KEYS, loadNumber, saveNumber } from "@/lib/storage";

export const DEFAULT_COINS = 1240;

export function useCoins() {
  const [coins, setCoins] = useState(DEFAULT_COINS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCoins(loadNumber(LS_KEYS.coins, DEFAULT_COINS));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveNumber(LS_KEYS.coins, coins);
  }, [coins, hydrated]);

  const resetCoins = () => setCoins(DEFAULT_COINS);
  const spendCoins = (amount: number) => setCoins((current) => current - amount);

  return {
    coins,
    setCoins: setCoins as Dispatch<SetStateAction<number>>,
    resetCoins,
    spendCoins,
  };
}
