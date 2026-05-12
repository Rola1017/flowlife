"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { LS_KEYS, loadNumber, saveNumber } from "@/lib/storage";

export const DEFAULT_COINS = 0;

export function useCoins() {
  const [coins, setCoins] = useState(DEFAULT_COINS);
  const [hydrated, setHydrated] = useState(false);
  const coinsRef = useRef(DEFAULT_COINS);

  useEffect(() => {
    const savedCoins = loadNumber(LS_KEYS.coins, DEFAULT_COINS);
    coinsRef.current = savedCoins;
    setCoins(savedCoins);
    setHydrated(true);
  }, []);

  useEffect(() => {
    coinsRef.current = coins;
  }, [coins]);

  useEffect(() => {
    if (!hydrated) return;
    saveNumber(LS_KEYS.coins, coins);
  }, [coins, hydrated]);

  const resetCoins = () => {
    coinsRef.current = DEFAULT_COINS;
    setCoins(DEFAULT_COINS);
  };
  const spendCoins = useCallback(
    (amount: number) => {
      if (coinsRef.current < amount) return false;
      coinsRef.current -= amount;
      setCoins(coinsRef.current);
      return true;
    },
    [],
  );

  return {
    coins,
    setCoins: setCoins as Dispatch<SetStateAction<number>>,
    resetCoins,
    spendCoins,
  };
}
