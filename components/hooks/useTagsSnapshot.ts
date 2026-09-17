"use client";

import { useEffect, useState } from "react";
import { APP_STATE_KEYS, subscribeAppState } from "@/lib/appStateCloud";
import { loadTagGroups, loadTags } from "@/lib/tagsStore";
import type { Tag, TagGroup } from "@/lib/tags";

/** 標籤樹快取：訂閱雲端／本機寫入才重讀，避免每次 render 都 loadJSON */
export function useTagsSnapshot(): { tags: Tag[]; groups: TagGroup[] } {
  const [tags, setTags] = useState<Tag[]>(() => loadTags());
  const [groups, setGroups] = useState<TagGroup[]>(() => loadTagGroups());
  useEffect(() => {
    const u1 = subscribeAppState(APP_STATE_KEYS.tags, () => setTags(loadTags()));
    const u2 = subscribeAppState(APP_STATE_KEYS.tagGroups, () => setGroups(loadTagGroups()));
    return () => {
      u1();
      u2();
    };
  }, []);
  return { tags, groups };
}
