/** 分頁／子頁切換時主捲動容器回到頂端。唯一實作；日詳情換日不得呼叫。 */
export function resetMainScroll(scroller: HTMLElement | null) {
  if (scroller) scroller.scrollTop = 0;
}
