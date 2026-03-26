import { useState } from "react";
import { Avatar, Box, Button, ListItemText, Menu, MenuItem, Paper } from "@mui/material";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";

type BottomNavProps = {
  isAuthenticated: boolean;
  userAvatar?: string | null;
  authEmail?: string | null;
  effectiveAccountEmail?: string | null;
  canSwitchAccounts?: boolean;
  currentPage: "lessons" | "students";
  onLessonsClick: () => void;
  onStudentsClick: () => void;
  onAuthClick: () => void;
  onLogout: () => void;
  onManageAccounts?: () => void;
  onPrimaryAction: () => void;
  showPrimaryAction: boolean;
  onDeleteLesson: () => void;
  showDelete: boolean;
};

const BottomNav = ({
  isAuthenticated,
  userAvatar,
  authEmail,
  effectiveAccountEmail,
  canSwitchAccounts,
  currentPage,
  onLessonsClick,
  onStudentsClick,
  onAuthClick,
  onLogout,
  onManageAccounts,
  onPrimaryAction,
  showPrimaryAction,
  onDeleteLesson,
  showDelete,
}: BottomNavProps) => {
  const isLessons = currentPage === "lessons";
  const isStudents = currentPage === "students";
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(menuAnchor);
  const normalizedAuthEmail = String(authEmail || "").trim().toLowerCase();
  const normalizedEffectiveEmail = String(effectiveAccountEmail || "")
    .trim()
    .toLowerCase();
  const impersonating =
    Boolean(normalizedAuthEmail) &&
    Boolean(normalizedEffectiveEmail) &&
    normalizedEffectiveEmail !== normalizedAuthEmail;

  return (
    <Paper
      elevation={3}
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 56,
        px: 0,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "space-between",
        borderTop: "1px solid rgba(0,0,0,0.08)",
        backgroundColor: "#fff",
        opacity: 1,
        borderRadius: 0,
        zIndex: 1300,
      }}
    >
      <Box display="flex" alignItems="stretch" width="100%" justifyContent="space-around">
        <Button
          onClick={onLessonsClick}
          sx={{
            minWidth: 0,
            px: 2,
            borderRadius: 999,
            color: "primary.main",
            backgroundColor: isLessons ? "rgba(230,81,0,0.18)" : "transparent",
            height: "100%",
          }}
        >
          <DescriptionRoundedIcon />
        </Button>
        <Button
          onClick={onStudentsClick}
          sx={{
            minWidth: 0,
            px: 2,
            borderRadius: 999,
            color: "primary.main",
            backgroundColor: isStudents ? "rgba(230,81,0,0.18)" : "transparent",
            height: "100%",
          }}
        >
          <GroupsRoundedIcon />
        </Button>
        {showPrimaryAction ? (
          <Button
            onClick={onPrimaryAction}
            sx={{
              minWidth: 0,
              px: 2,
              borderRadius: 999,
              color: "primary.main",
              height: "100%",
            }}
          >
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: "999px",
                border: "2px solid",
                borderColor: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AddRoundedIcon />
            </Box>
          </Button>
        ) : null}
        {isLessons && showDelete ? (
          <Button
            onClick={onDeleteLesson}
            sx={{
              minWidth: 0,
              px: 2,
              borderRadius: 999,
              color: "error.main",
              height: "100%",
            }}
          >
            <DeleteRoundedIcon />
          </Button>
        ) : null}
        <Button
          onClick={(event) => {
            if (isAuthenticated) {
              setMenuAnchor(event.currentTarget);
            } else {
              onAuthClick();
            }
          }}
          sx={{
            minWidth: 0,
            px: 2,
            borderRadius: 999,
            color: "primary.main",
            height: "100%",
          }}
        >
          <Avatar
            src={userAvatar || undefined}
            alt="User"
            sx={{
              width: 36,
              height: 36,
              bgcolor: "secondary.main",
              border: "2px solid",
              borderColor: "primary.main",
            }}
          />
        </Button>
        <Menu
          anchorEl={menuAnchor}
          open={menuOpen}
          onClose={() => setMenuAnchor(null)}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
          transformOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <MenuItem
            disabled
            sx={{ opacity: "1 !important" }}
          >
            <ListItemText
              primary={impersonating ? `Viewing as ${effectiveAccountEmail}` : authEmail || "Account"}
              secondary={impersonating ? `Signed in as ${authEmail}` : "Signed in"}
            />
          </MenuItem>
          {canSwitchAccounts ? (
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                onManageAccounts?.();
              }}
            >
              Switch account
            </MenuItem>
          ) : null}
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onLogout();
            }}
          >
            Log out
          </MenuItem>
        </Menu>
      </Box>
    </Paper>
  );
};

export default BottomNav;
