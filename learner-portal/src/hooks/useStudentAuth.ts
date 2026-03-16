import { useCallback, useEffect, useState } from "react";
import {
  fetchStudentSession,
  loginStudent,
  logoutStudent,
  type StudentSession,
} from "../api/student";

type UseStudentAuthResult = {
  student: StudentSession["student"] | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (name: string, passcode: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useStudentAuth = (apiBaseUrl: string): UseStudentAuthResult => {
  const [student, setStudent] = useState<StudentSession["student"] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      setLoading(true);
      try {
        const session = await fetchStudentSession(apiBaseUrl);
        if (active) {
          setStudent(session.student);
        }
      } catch {
        if (active) {
          setStudent(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadSession();

    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  const login = useCallback(
    async (name: string, passcode: string) => {
      const session = await loginStudent(apiBaseUrl, { name, passcode });
      setStudent(session.student);
    },
    [apiBaseUrl]
  );

  const logout = useCallback(async () => {
    await logoutStudent(apiBaseUrl);
    setStudent(null);
  }, [apiBaseUrl]);

  return {
    student,
    isAuthenticated: Boolean(student),
    loading,
    login,
    logout,
  };
};
