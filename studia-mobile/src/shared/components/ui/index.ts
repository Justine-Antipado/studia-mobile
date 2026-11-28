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
  AnnouncementCard,
  type AnnouncementCardProps,
} from "@/shared/components/ui/announcement-card";
export { ArrowCard, type ArrowCardProps } from "@/shared/components/ui/arrow-card";
export {
  AppImage,
  clearImageCache,
  prefetchImages,
} from "@/shared/components/ui/app-image";
export { Avatar } from "@/shared/components/ui/avatar";
export { Badge } from "@/shared/components/ui/badge";
export { BottomSheet } from "@/shared/components/ui/bottom-sheet";
export { Card } from "@/shared/components/ui/card";
export { DateTimeField, formatDate, formatDateTime } from "@/shared/components/ui/date-time-field";
export { SelectField, type SelectOption } from "@/shared/components/ui/select-field";
export { Chip } from "@/shared/components/ui/chip";
export { CommentComposer } from "@/shared/components/ui/comment-composer";
export { CommentRow } from "@/shared/components/ui/comment-row";
export { ConfirmDialog, type ConfirmDialogProps } from "@/shared/components/ui/confirm-dialog";
export {
  CustomDropdown,
  toOptions,
  type CustomDropdownProps,
  type DropdownOption,
} from "@/shared/components/ui/dropdown";
export { EmptyState } from "@/shared/components/ui/empty-state";
export {
  ErrorBoundary,
  ErrorFallback,
  type FallbackProps,
} from "@/shared/components/ui/error-boundary";
export { FeatureBoundary, FeatureFallback } from "@/shared/components/ui/feature-boundary";
export { FeedbackNote } from "@/shared/components/ui/feedback-note";
export {
  FilterPillSheet,
  type FilterGroup,
  type FilterOption,
  type FilterValues,
} from "@/shared/components/ui/filter-pill-sheet";
export { FormField, type FormFieldProps } from "@/shared/components/ui/form-field";
export { Icon, ICON_SIZE, IconTile, type IconName, type IconSize } from "@/shared/components/ui/icon";
export { ListRow, type ListRowProps } from "@/shared/components/ui/list-row";
export { ListState, type DisplayError } from "@/shared/components/ui/list-state";
export { OfflineBanner } from "@/shared/components/ui/offline-banner";
export { PageTitle } from "@/shared/components/ui/page-title";
export { ProgressBar } from "@/shared/components/ui/progress-bar";
export {
  PullToRefreshProvider,
  refreshControlFor,
  useScreenPullToRefresh,
  type PullToRefresh,
} from "@/shared/components/ui/pull-to-refresh";
export { QuickAction } from "@/shared/components/ui/quick-action";
export { Reveal } from "@/shared/components/ui/reveal";
export { RoleGate } from "@/shared/components/ui/role-gate";
export { Screen } from "@/shared/components/ui/screen";
export { SectionHeader } from "@/shared/components/ui/section-header";
export { HorizontalChipBar } from "@/shared/components/ui/horizontal-chip-bar";
export { VideoLinkCard } from "@/shared/components/ui/video-link-card";
export { Skeleton, SkeletonList, SkeletonRow } from "@/shared/components/ui/skeleton";
export { StatCard } from "@/shared/components/ui/stat-card";
export { StudiaTabBar, type TabItem } from "@/shared/components/ui/studia-tab-bar";
export { ToastProvider, useToast } from "@/shared/components/ui/toast";
