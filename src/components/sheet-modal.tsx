import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  BottomSheet,
  BottomSheetScrollView,
  BottomSheetView,
} from "@expo/ui/community/bottom-sheet";

export type SheetModalProps = {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
  snapPoints?: (string | number)[];
  initialIndex?: number;
  backgroundColor?: string;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Platform-native sheet: Material 3 on Android, SwiftUI on iOS, and a drawer on web. */
export default function SheetModal({
  visible,
  onRequestClose,
  children,
  snapPoints,
  initialIndex = 0,
  backgroundColor,
  contentStyle,
}: SheetModalProps) {
  return (
    <BottomSheet
      index={visible ? initialIndex : -1}
      snapPoints={snapPoints}
      enableDynamicSizing={!snapPoints?.length}
      enablePanDownToClose
      onClose={onRequestClose}
      backgroundStyle={backgroundColor ? { backgroundColor } : undefined}
    >
      <BottomSheetView style={contentStyle}>{children}</BottomSheetView>
    </BottomSheet>
  );
}

export const SheetScrollView = BottomSheetScrollView;
