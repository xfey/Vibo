import { useEffect, useMemo, useRef, useState } from 'react';

interface UseWorkspaceTabShortcutsOptions {
  enabled: boolean;
  tabIds: readonly string[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
}

interface WorkspaceTabShortcutState {
  areHintsVisible: boolean;
  tabShortcutLabels: Record<string, string>;
  createSessionShortcutLabel: string;
}

const MAX_TAB_SHORTCUT_COUNT = 9;
const CREATE_SESSION_SHORTCUT_LABEL = 'N';

function getTabShortcutIndex(event: KeyboardEvent): number | null {
  if (event.code.startsWith('Digit')) {
    const parsedIndex = Number.parseInt(event.code.slice('Digit'.length), 10);
    return Number.isInteger(parsedIndex) && parsedIndex >= 1 && parsedIndex <= MAX_TAB_SHORTCUT_COUNT
      ? parsedIndex - 1
      : null;
  }

  if (event.code.startsWith('Numpad')) {
    const parsedIndex = Number.parseInt(event.code.slice('Numpad'.length), 10);
    return Number.isInteger(parsedIndex) && parsedIndex >= 1 && parsedIndex <= MAX_TAB_SHORTCUT_COUNT
      ? parsedIndex - 1
      : null;
  }

  return null;
}

function getWrappedTabId(
  tabIds: readonly string[],
  activeTabId: string | null,
  direction: 'previous' | 'next',
): string | null {
  if (tabIds.length === 0) {
    return null;
  }

  const activeIndex = activeTabId ? tabIds.indexOf(activeTabId) : -1;

  if (activeIndex === -1) {
    return direction === 'previous' ? tabIds.at(-1) ?? null : tabIds[0] ?? null;
  }

  if (direction === 'previous') {
    return tabIds[(activeIndex - 1 + tabIds.length) % tabIds.length] ?? null;
  }

  return tabIds[(activeIndex + 1) % tabIds.length] ?? null;
}

export function useWorkspaceTabShortcuts({
  enabled,
  tabIds,
  activeTabId,
  onSelectTab,
}: UseWorkspaceTabShortcutsOptions): WorkspaceTabShortcutState {
  const [areHintsVisible, setAreHintsVisible] = useState(false);
  const tabIdsRef = useRef(tabIds);
  const activeTabIdRef = useRef<string | null>(activeTabId);
  const onSelectTabRef = useRef(onSelectTab);

  useEffect(() => {
    tabIdsRef.current = tabIds;
  }, [tabIds]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    onSelectTabRef.current = onSelectTab;
  }, [onSelectTab]);

  const tabShortcutLabels = useMemo<Record<string, string>>(
    () =>
      Object.fromEntries(
        tabIds
          .slice(0, MAX_TAB_SHORTCUT_COUNT)
          .map((tabId, index) => [tabId, String(index + 1)]),
      ),
    [tabIds],
  );

  useEffect(() => {
    if (!enabled) {
      setAreHintsVisible(false);
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Meta') {
        setAreHintsVisible(true);
        return;
      }

      if (!event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      setAreHintsVisible(true);

      const tabShortcutIndex = getTabShortcutIndex(event);

      if (tabShortcutIndex !== null) {
        const targetTabId = tabIdsRef.current[tabShortcutIndex];

        if (!targetTabId) {
          return;
        }

        event.preventDefault();
        activeTabIdRef.current = targetTabId;
        onSelectTabRef.current(targetTabId);
        return;
      }

      if (event.shiftKey && (event.code === 'BracketLeft' || event.code === 'BracketRight')) {
        const targetTabId = getWrappedTabId(
          tabIdsRef.current,
          activeTabIdRef.current,
          event.code === 'BracketLeft' ? 'previous' : 'next',
        );

        if (!targetTabId) {
          return;
        }

        event.preventDefault();
        activeTabIdRef.current = targetTabId;
        onSelectTabRef.current(targetTabId);
        return;
      }

    }

    function handleKeyUp(event: KeyboardEvent): void {
      if (event.key === 'Meta' || !event.metaKey) {
        setAreHintsVisible(false);
      }
    }

    function hideHints(): void {
      setAreHintsVisible(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', hideHints);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', hideHints);
    };
  }, [enabled]);

  return {
    areHintsVisible,
    tabShortcutLabels,
    createSessionShortcutLabel: CREATE_SESSION_SHORTCUT_LABEL,
  };
}
