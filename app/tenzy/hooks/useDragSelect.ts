import { useCallback, useEffect, useRef } from "react";
import { GameGridCellId, Point, Rect } from "@/app/tenzy/types";
import type { GameState } from "@/app/tenzy/context/GameContext"; // importing GameState type
import type { GameAction } from "@/app/tenzy/context/GameContext";
import { scoringStrategy } from "../scoring";

// Define the shape of a cached cell rectangle (relative to container)
type CellBounds = {
  id: GameGridCellId;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

interface UseDragSelectParams {
  gameContainerRef: React.RefObject<HTMLDivElement | null>;
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  playSfx: () => void;
}

export function useDragSelect({
  gameContainerRef,
  state,
  dispatch,
  playSfx,
}: UseDragSelectParams) {
  // Refs to track ongoing selection state without causing re-renders
  const isSelectingRef = useRef(false);
  const originRef = useRef<Point | null>(null);
  const cellRectsRef = useRef<CellBounds[] | null>(null);

  // Pointer Down: initialize selection
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return; // only respond to left mouse button or primary touch
      if (!gameContainerRef.current) return;
      if (isSelectingRef.current) return; // already in a selection (ignore additional touches)
      isSelectingRef.current = true;
      // Compute origin relative to container
      const containerRect = gameContainerRef.current.getBoundingClientRect();
      const originX = e.clientX - containerRect.left;
      const originY = e.clientY - containerRect.top;
      originRef.current = { x: originX, y: originY };
      // Cache all cell positions (relative to container)
      const cellElements =
        gameContainerRef.current.querySelectorAll<HTMLElement>(
          "[data-selectable]"
        );
      const cellRects: CellBounds[] = [];
      cellElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        cellRects.push({
          id: el.id,
          left: rect.left - containerRect.left,
          top: rect.top - containerRect.top,
          right: rect.right - containerRect.left,
          bottom: rect.bottom - containerRect.top,
        });
      });
      cellRectsRef.current = cellRects;
      // Initialize selection box in state (origin and zero-size rect)
      dispatch({
        type: "START_SELECTION",
        payload: {
          userSelectBoxOrigin: { x: originX, y: originY },
          userSelectBoxRect: {
            left: originX,
            top: originY,
            width: 0,
            height: 0,
          },
        },
      });

      // (Optional: capture the pointer to continue getting events even if it leaves the element)
      // e.currentTarget.setPointerCapture(e.pointerId);
    },
    [gameContainerRef, dispatch]
  );

  // Pointer Move: update selection box and highlighted cells
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (
        !isSelectingRef.current ||
        !originRef.current ||
        !gameContainerRef.current
      )
        return;
      // Calculate new selection rect relative to container
      const containerRect = gameContainerRef.current.getBoundingClientRect();
      const currX = e.clientX - containerRect.left;
      const currY = e.clientY - containerRect.top;
      const orig = originRef.current;
      const left = Math.min(orig.x, currX);
      const top = Math.min(orig.y, currY);
      const width = Math.abs(currX - orig.x);
      const height = Math.abs(currY - orig.y);
      const newRect: Rect = { left, top, width, height };
      // Determine which cells intersect this rect
      const selectedIds = new Set<GameGridCellId>();
      if (cellRectsRef.current) {
        for (const cell of cellRectsRef.current) {
          const intersects = !(
            cell.right < left ||
            cell.left > left + width ||
            cell.bottom < top ||
            cell.top > top + height
          );
          if (intersects) {
            selectedIds.add(cell.id);
          }
        }
      }
      // Update selection box and selected cells in state
      dispatch({
        type: "UPDATE_SELECTION",
        payload: {
          userSelectBoxOrigin: originRef.current,
          userSelectBoxRect: newRect,
          userSelectedGameGridCellIds: selectedIds,
        },
      });
    },
    [gameContainerRef, dispatch]
  );
  const handlePointerUp = useCallback(() => {
    if (!isSelectingRef.current) return;
    isSelectingRef.current = false;
    const selectedCells = state.gameGridCells.filter((cell) =>
      state.userSelectedGameGridCellIds.has(cell.id)
    );
    const isValid = scoringStrategy.validate(selectedCells);
    if (isValid) {
      playSfx();
      dispatch({
        type: "SUBMIT_SELECTION",
        payload: { userSelectedGameGridCells: selectedCells },
      });
    } else {
      dispatch({ type: "RESET_SELECTION" });
    }
  }, [
    state.gameGridCells,
    state.userSelectedGameGridCellIds,
    dispatch,
    playSfx,
  ]);

  // Pointer Leave: cancel the selection if pointer leaves container
  const handlePointerLeave = useCallback(() => {
    if (!isSelectingRef.current) return;
    isSelectingRef.current = false;
    dispatch({ type: "RESET_SELECTION" });
  }, [dispatch]);

  // Pointer Cancel: handle event cancellation (e.g., touch cancel)
  const handlePointerCancel = useCallback(() => {
    if (!isSelectingRef.current) return;
    isSelectingRef.current = false;
    dispatch({ type: "RESET_SELECTION" });
  }, [dispatch]);

  // Window blur: if the window loses focus during a drag, cancel the selection to prevent a stuck state
  useEffect(() => {
    const handleWindowBlur = () => {
      if (isSelectingRef.current) {
        isSelectingRef.current = false;
        dispatch({ type: "RESET_SELECTION" });
      }
    };
    window.addEventListener("blur", handleWindowBlur);
    return () => window.removeEventListener("blur", handleWindowBlur);
  }, [dispatch]);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
    handlePointerCancel,
  };
}
