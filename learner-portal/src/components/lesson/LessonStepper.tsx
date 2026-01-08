import {
  Box,
  IconButton,
  Step,
  StepButton,
  Stepper,
} from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { LessonSectionKey } from "../../state/types";
import { getSectionLabel } from "../../utils/lessonSections";

type LessonStepperProps = {
  openSection: LessonSectionKey;
  completedSections: Record<LessonSectionKey, boolean>;
  sectionKeys: LessonSectionKey[];
  onOpenSection: (section: LessonSectionKey) => void;
  canNavigateTo: (section: LessonSectionKey) => boolean;
  onReset: () => void;
};

const LessonStepper = ({
  openSection,
  completedSections,
  sectionKeys,
  onOpenSection,
  canNavigateTo,
  onReset,
}: LessonStepperProps) => {
  return (
    <Box className="lesson-stepper">
      <Box className="lesson-stepper-inner">
        <Stepper nonLinear activeStep={sectionKeys.indexOf(openSection)}>
          {sectionKeys.map((sectionKey) => (
            <Step
              key={sectionKey}
              completed={Boolean(completedSections[sectionKey])}
            >
              <StepButton
                onClick={() => onOpenSection(sectionKey)}
                disabled={!canNavigateTo(sectionKey)}
                sx={{
                  "& .MuiStepLabel-label": {
                    color: completedSections[sectionKey]
                      ? "success.main"
                      : sectionKey === openSection
                      ? "primary.main"
                      : "text.disabled",
                    fontWeight: completedSections[sectionKey] ? 600 : 500,
                  },
                }}
                icon={
                  <CheckCircleRoundedIcon
                    sx={{
                      color:
                        completedSections[sectionKey]
                          ? "success.main"
                          : sectionKey === openSection
                          ? "primary.main"
                          : "text.disabled",
                    }}
                  />
                }
              >
                {getSectionLabel(sectionKey)}
              </StepButton>
            </Step>
          ))}
        </Stepper>
      </Box>
      <IconButton className="lesson-stepper-refresh" onClick={() => window.location.reload()}>
        <RefreshRoundedIcon />
      </IconButton>
      <IconButton className="lesson-stepper-reset" onClick={onReset}>
        <RestartAltRoundedIcon />
      </IconButton>
    </Box>
  );
};

export default LessonStepper;
