"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { LS_KEYS, loadNumber, saveNumber } from "@/lib/storage";
import { APP_STATE_KEYS, pushAppState, subscribeAppState } from "@/lib/appStateCloud";

export const DEFAULT_COINS = 0;

export function useCoins() {
  const [coins, setCoins] = useState(DEFAULT_COINS);
  const [hydrated, setHydrated] = useState(false);
  const coinsRef = useRef(DEFAULT_COINS);
  const lastPushedRef = useRef<number | null>(null);

  useEffect(() => {
    const savedCoins = loadNumber(LS_KEYS.coins, DEFAULT_COINS);
    coinsRef.current = savedCoins;
    lastPushedRef.current = savedCoins;
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

  // 本地變動才推（lastPushedRef 擋掉遠端套用後回推）
  useEffect(() => {
    if (!hydrated) return;
    if (lastPushedRef.current === coins) return;
    lastPushedRef.current = coins;
    void pushAppState(APP_STATE_KEYS.coins, coins);
  }, [coins, hydrated]);

  // 遠端套用：雲端較新時讀回本地
  useEffect(
    () =>
      subscribeAppState(APP_STATE_KEYS.coins, () => {
        const v = loadNumber(LS_KEYS.coins, DEFAULT_COINS);
        lastPushedRef.current = v;
        coinsRef.current = v;
        setCoins(v);
      }),
    [],
  );

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
