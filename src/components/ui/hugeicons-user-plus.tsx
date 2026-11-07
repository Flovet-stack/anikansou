"use client";

import type {
  LegacyAnimationControls,
  ResolvedValues,
  VisualElement,
} from "motion";
import type { Variants } from "motion/react";
import type { ForwardedRef, HTMLAttributes } from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { getDefaultValueType, setTarget, visualElementStore } from "motion";
import { motion, useAnimation } from "motion/react";

import { cn } from "@/lib/utils";

import { useControlHover } from "./use-control-hover";

export interface HugeiconsUserPlusIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}
interface HugeiconsUserPlusIconProps extends HTMLAttributes<HTMLSpanElement> {
  size?: number;
}
const PLUS_VARIANTS: Variants = {
  normal: {
    scale: 1,
    rotate: 0,
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
  animate: {
    scale: [0, 1.15, 1],
    rotate: [-90, 0, 0],
    opacity: [0, 1, 1],
    transition: {
      delay: 0.25,
      duration: 0.45,
      ease: "easeOut",
      times: [0, 0.7, 1],
    },
  },
};
const HugeiconsUserPlusIcon = forwardRef<
  HugeiconsUserPlusIconHandle,
  HugeiconsUserPlusIconProps
>(({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
  const controls = useAnimation();
  const isControlledRef = useRef(false);
  const {
    rootRef: iconRootRef,
    reduceDefinition,
    ...iconAccessibility
  } = useIconAccessibility(ref, () => {
    isControlledRef.current = ref != null;
    return {
      startAnimation: () => controls.start("animate"),
      stopAnimation: () => controls.start("normal"),
    };
  }, [controls]);
  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      if (isControlledRef.current) {
        void e;
      } else {
        controls.start("animate");
      }
    },
    [controls],
  );
  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      if (isControlledRef.current) {
        void e;
      } else {
        controls.start("normal");
      }
    },
    [controls],
  );
  return (
    <span
      className={cn("inline-flex shrink-0", className)}
      {...props}
      ref={iconRootRef}
      onMouseEnter={(event) => {
        if (!iconAccessibility.isControlled() && !iconAccessibility.reduced) {
          handleMouseEnter(event);
        }
        onMouseEnter?.(event);
      }}
      onMouseLeave={(event) => {
        if (!iconAccessibility.isControlled()) {
          handleMouseLeave(event);
        }
        onMouseLeave?.(event);
      }}
      onFocus={(event) => {
        if (!iconAccessibility.isControlled() && !iconAccessibility.reduced) {
          iconAccessibility.startAnimation();
        }
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        if (!iconAccessibility.isControlled()) {
          iconAccessibility.stopAnimation();
        }
        props.onBlur?.(event);
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M13 13.5028C11.9287 13.1795 10.7448 13 9.5 13C7.72212 13 6.0685 13.3661 4.68968 13.9946C3.55927 14.5099 3 15.7281 3 16.9704V19"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <circle
          cx="9.5"
          cy="6.5"
          r="3.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <motion.g
          animate={reduceDefinition(controls)}
          initial="normal"
          style={{ transformOrigin: "17.5px 17.5px" }}
          variants={PLUS_VARIANTS}
        >
          <path
            d="M17.5 21L17.5 14M14 17.5H21"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </motion.g>
      </svg>
    </span>
  );
});
HugeiconsUserPlusIcon.displayName = "HugeiconsUserPlusIcon";
export { HugeiconsUserPlusIcon };

type IconAccessibilityHandle = {
  startAnimation: () => unknown;
  stopAnimation: () => unknown;
};

type IconAccessibilitySnapshot = {
  visual: VisualElement;
  values: ResolvedValues;
  attributes: Record<string, string>;
};

function useIconAccessibility(
  ref: ForwardedRef<IconAccessibilityHandle>,
  createHandle: () => IconAccessibilityHandle,
  controllers: LegacyAnimationControls[],
) {
  const rawHandle = createHandle();
  const raw = useRef(rawHandle);
  useEffect(() => {
    raw.current = rawHandle;
  }, [rawHandle]);
  const controls = useRef(controllers);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const preference = useRef(false);
  const mounted = useRef(true);
  const [reduced, setReduced] = useState(false);
  const api = useMemo(
    () => ({
      startAnimation() {
        if (
          mounted.current &&
          !preference.current &&
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
          void raw.current.startAnimation();
        }
      },
      stopAnimation() {
        if (mounted.current) void raw.current.stopAnimation();
      },
    }),
    [],
  );
  useImperativeHandle(ref, () => api, [api]);
  // Vendoring edit 3: play when the surrounding button or link is hovered
  // or focused, not only the icon itself (spec 06).
  const hasControl = useControlHover(
    rootRef,
    api.startAnimation,
    api.stopAnimation,
  );

  useEffect(() => {
    mounted.current = true;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const snapshots: IconAccessibilitySnapshot[] = [];
    rootRef.current
      ?.querySelectorAll<SVGElement>("svg, svg *")
      .forEach((element) => {
        const visual = visualElementStore.get(element);
        if (visual)
          snapshots.push({
            visual,
            values: { ...visual.latestValues },
            attributes: Object.fromEntries(
              [...element.attributes].map((attribute) => [
                attribute.name,
                attribute.value,
              ]),
            ),
          });
      });
    const restore = () => {
      for (const snapshot of snapshots) {
        const { visual, values, attributes } = snapshot;
        visual.values.forEach((value) => value.stop());
        const props = visual.getProps() as unknown as {
          [key: string]: unknown;
          style?: Record<string, unknown>;
        };
        const reset: Record<string, string | number> = {};
        visual.values.forEach((_motionValue, key) => {
          const attribute = key.replace(
            /[A-Z]/g,
            (letter) => "-" + letter.toLowerCase(),
          );
          const defaults: Record<string, number> = {
            opacity: 1,
            pathLength: 1,
            pathSpacing: 1,
            pathOffset: 0,
            strokeDashoffset: 0,
          };
          const value =
            values[key] ??
            props.style?.[key] ??
            props[key] ??
            getDefaultValueType(key)?.default ??
            defaults[key] ??
            attributes[attribute];
          if (typeof value === "number" || typeof value === "string")
            reset[key] = value;
        });
        setTarget(visual, reset);
        visual.render();
      }
    };
    const activeControls = controls.current;
    const originals = activeControls.map((control) => {
      const original = control.start;
      control.start = (definition, transition) => {
        if (!mounted.current) return new Promise<never>(() => {});
        if (preference.current) {
          control.set(definition);
          return Promise.resolve();
        }
        return original(definition, transition);
      };
      return original;
    });
    const change = () => {
      preference.current = media.matches;
      setReduced(media.matches);
      if (media.matches) {
        void raw.current.stopAnimation();
        activeControls.forEach((control) => control.stop());
        restore();
      }
    };
    change();
    media.addEventListener("change", change);
    return () => {
      mounted.current = false;
      media.removeEventListener("change", change);
      activeControls.forEach((control, index) => {
        control.stop();
        const original = originals[index];
        if (original) control.start = original;
      });
    };
  }, []);

  return {
    ...api,
    rootRef,
    // Driven by a ref or by the surrounding control: the icon's own
    // hover handlers stand down.
    // A function, read when an event fires: by then the effect has found
    // the control (a value read during render would always be false).
    isControlled: () => ref != null || hasControl.current,
    reduced,
    reduceDefinition<T>(definition: T): T {
      if (
        reduced &&
        definition &&
        typeof definition === "object" &&
        !Array.isArray(definition) &&
        !("start" in definition)
      ) {
        return {
          ...definition,
          transition: { type: false, duration: 0, delay: 0, repeat: 0 },
        } as T;
      }
      return definition;
    },
  };
}
