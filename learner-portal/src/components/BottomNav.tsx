import { useState } from "react";
import { Avatar, Box, Button, Menu, MenuItem, Paper } from "@mui/material";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";

type BottomNavProps = {
  isAuthenticated: boolean;
  userAvatar?: string | null;
  currentPage: "home" | "lesson";
  onLessonsClick: () => void;
  onHomeClick: () => void;
  onAuthClick: () => void;
  onLogout: () => void;
};

const BottomNav = ({
  isAuthenticated,
  userAvatar,
  currentPage,
  onLessonsClick,
  onHomeClick,
  onAuthClick,
  onLogout,
}: BottomNavProps) => {
  const isHome = currentPage === "home";
  const isLessons = currentPage === "lesson";
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(menuAnchor);

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
          onClick={onHomeClick}
          sx={{
            minWidth: 0,
            px: 2,
            borderRadius: 999,
            color: "primary.main",
            backgroundColor: isHome ? "rgba(230,81,0,0.18)" : "transparent",
            height: "100%",
          }}
        >
          <HomeRoundedIcon />
        </Button>
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
