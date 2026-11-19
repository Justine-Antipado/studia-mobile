// shared/components/ui — barrel. New code imports primitives from here:
//   import { Card, ListRow, Badge, EmptyState } from "@/shared/components/ui";
// Every primitive is exported here; there is no compatibility shim any more.
export { ActionButton, type ActionButtonProps } from "@/shared/components/ui/action-button";
export { AiTag } from "@/shared/components/ui/ai-tag";
export { AppButton } from "@/shared/components/ui/app-button";
export { AppList } from "@/shared/components/ui/app-list";
export { AttachmentRow } from "@/shared/components/ui/attachment-row";
export { AppHeader } from "@/shared/components/ui/app-header";
export {
  AppImage,
  clearImageCache,
  prefetchImages,
} from "@/shared/components/ui/app-image";
export { Avatar } from "@/shared/components/ui/avatar";
export { Badge } from "@/shared/components/ui/badge";
export { BottomSheet } from "@/shared/components/ui/bottom-sheet";
export { Card } from "@/shared/components/ui/card";
export { Chip } from "@/shared/components/ui/chip";
export { CommentRow } from "@/shared/components/ui/comment-row";
export { ConfirmDialog, type ConfirmDialogProps } from "@/shared/components/ui/confirm-dialog";
export { EmptyState } from "@/shared/components/ui/empty-state";
export { ErrorBoundary, ErrorFallback } from "@/shared/components/ui/error-boundary";
export { FormField, type FormFieldProps } from "@/shared/components/ui/form-field";
export { Icon, ICON_SIZE, IconTile, type IconName, type IconSize } from "@/shared/components/ui/icon";
export { ListRow, type ListRowProps } from "@/shared/components/ui/list-row";
export { ListState, type DisplayError } from "@/shared/components/ui/list-state";
export { OfflineBanner } from "@/shared/components/ui/offline-banner";
export { PageTitle } from "@/shared/components/ui/page-title";
export { ProgressBar } from "@/shared/components/ui/progress-bar";
export { QuickAction } from "@/shared/components/ui/quick-action";
export { RoleGate } from "@/shared/components/ui/role-gate";
export { Screen } from "@/shared/components/ui/screen";
export { SearchField } from "@/shared/components/ui/search-field";
export { SectionHeader } from "@/shared/components/ui/section-header";
export { SegmentedTabs } from "@/shared/components/ui/segmented-tabs";
export { Skeleton, SkeletonList, SkeletonRow } from "@/shared/components/ui/skeleton";
export { StatCard } from "@/shared/components/ui/stat-card";
export { StudiaTabBar, type TabItem } from "@/shared/components/ui/studia-tab-bar";
export { ToastProvider, useToast } from "@/shared/components/ui/toast";
