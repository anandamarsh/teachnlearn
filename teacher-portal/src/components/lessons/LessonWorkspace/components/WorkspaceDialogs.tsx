import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

type WorkspaceDialogsProps = {
  confirmClose: string | null;
  onCancelClose: () => void;
  onConfirmClose: () => void;
  publishOpen: boolean;
  onCancelPublish: () => void;
  onConfirmPublish: () => void;
};

const WorkspaceDialogs = ({
  confirmClose,
  onCancelClose,
  onConfirmClose,
  publishOpen,
  onCancelPublish,
  onConfirmPublish,
}: WorkspaceDialogsProps) => (
  <>
    <Dialog open={Boolean(confirmClose)} onClose={onCancelClose}>
      <DialogTitle>Discard changes?</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary">
          You have unsaved changes. Closing will discard them.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancelClose}>Cancel</Button>
        <Button color="error" variant="contained" onClick={onConfirmClose}>
          Discard
        </Button>
      </DialogActions>
    </Dialog>
    <Dialog open={publishOpen} onClose={onCancelPublish}>
      <DialogTitle>Publish lesson?</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary">
          This will publish the lesson. Once published, it can’t be unpublished.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancelPublish}>Cancel</Button>
        <Button variant="contained" onClick={onConfirmPublish}>
          Publish
        </Button>
      </DialogActions>
    </Dialog>
  </>
);

export default WorkspaceDialogs;
