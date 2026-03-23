import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import axios from "axios";

const CreateWorkdayModal = ({
  show,
  onClose,
  date,
  onWorkdayCreated,
  employees = [],
}) => {
  const [timeslots, setTimeslots] = useState([
    {
      startTime: "09:00",
      endTime: "11:00",
      maxEmployees: 2,
      assignedUsers: [],
    },
  ]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (show) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [show]);

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (time) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const addTimeslot = () => {
    setTimeslots([
      ...timeslots,
      {
        startTime: "09:00",
        endTime: "11:00",
        maxEmployees: 2,
        assignedUsers: [],
      },
    ]);
  };

  const removeTimeslot = (index) => {
    setTimeslots(timeslots.filter((_, i) => i !== index));
  };

  const updateTimeslot = (index, field, value) => {
    const updated = [...timeslots];
    updated[index][field] = value;
    setTimeslots(updated);
  };

  const handleEmployeeToggle = (timeslotIndex, employeeId) => {
    const slot = timeslots[timeslotIndex];
    const isSelected = slot.assignedUsers?.some(
      (au) => au.user._id === employeeId
    );

    let newAssignedUsers;

    if (isSelected) {
      newAssignedUsers = slot.assignedUsers.filter(
        (au) => au.user._id !== employeeId
      );
    } else {
      if (slot.assignedUsers.length >= slot.maxEmployees) {
        toast.error(
          `You can only select ${slot.maxEmployees} worker${
            slot.maxEmployees !== 1 ? "s" : ""
          } for this timeslot`
        );
        return;
      }

      const employee = employees.find((emp) => emp._id === employeeId);
      const newAssignment = {
        user: {
          _id: employeeId,
          name: employee ? employee.name : "Unknown",
        },
        notes: "",
      };

      newAssignedUsers = [...slot.assignedUsers, newAssignment];
    }

    updateTimeslot(timeslotIndex, "assignedUsers", newAssignedUsers);
  };

  const validateTimeslots = () => {
    for (let slot of timeslots) {
      if (!slot.startTime || !slot.endTime) {
        toast.error("Please fill in all start and end times");
        return false;
      }

      const start = new Date(`2000-01-01T${slot.startTime}:00`);
      const end = new Date(`2000-01-01T${slot.endTime}:00`);

      if (start >= end) {
        toast.error("End time must be after start time");
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateTimeslots()) return;

    setLoading(true);
    try {
      const authToken = JSON.parse(localStorage.getItem("auth"));
      const workdayData = {
        date: date.toISOString(),
        timeslots,
        notes: notes.trim(),
      };

      await axios.post(
        `${import.meta.env.VITE_API_URL}/workdays`,
        workdayData,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      
      toast.success("Workday created successfully!");
      onWorkdayCreated();
      onClose();
    } catch (error) {
      console.error("Error creating workday:", error);
      toast.error(
        error.response?.data?.error || "Failed to create workday"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  if (!show) return null;

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Create Workday</h2>
            <p style={styles.subtitle}>{formatDate(date)}</p>
          </div>
          <button 
            style={styles.closeBtn} 
            onClick={handleClose}
            disabled={loading}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={styles.content}>
          <form onSubmit={handleSubmit}>
            {/* Timeslots Section */}
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <h3 style={styles.sectionTitle}>Timeslots</h3>
                <button
                  type="button"
                  onClick={addTimeslot}
                  style={styles.addBtn}
                  disabled={loading}
                >
                  + Add Slot
                </button>
              </div>

              {timeslots.map((slot, index) => (
                <div key={index} style={styles.timeslot}>
                  <div style={styles.timeslotHeader}>
                    <span style={styles.slotNumber}>{index + 1}</span>
                    {slot.startTime && slot.endTime && (
                      <span style={styles.timePreview}>
                        {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                      </span>
                    )}
                    {timeslots.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTimeslot(index)}
                        style={styles.removeBtn}
                        disabled={loading}
                      >
                        🗑
                      </button>
                    )}
                  </div>

                  <div style={styles.inputRow}>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Start Time</label>
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) =>
                          updateTimeslot(index, "startTime", e.target.value)
                        }
                        style={styles.input}
                        disabled={loading}
                        required
                      />
                    </div>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>End Time</label>
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) =>
                          updateTimeslot(index, "endTime", e.target.value)
                        }
                        style={styles.input}
                        disabled={loading}
                        required
                      />
                    </div>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Max Workers</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={slot.maxEmployees}
                        onChange={(e) =>
                          updateTimeslot(index, "maxEmployees", parseInt(e.target.value))
                        }
                        style={styles.input}
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>

                  {/* Employee Selection */}
                  <div style={styles.employeeSection}>
                    <label style={styles.label}>Assign Workers</label>
                    <div style={styles.employeeList}>
                      {employees.map((employee) => {
                        const isSelected = slot.assignedUsers?.some(
                          (au) => au.user._id === employee._id
                        );
                        const isDisabled = 
                          !isSelected && 
                          slot.assignedUsers?.length >= slot.maxEmployees;

                        return (
                          <div
                            key={employee._id}
                            style={{
                              ...styles.employeeOption,
                              ...(isSelected ? styles.employeeSelected : {}),
                              ...(isDisabled ? styles.employeeDisabled : {}),
                            }}
                            onClick={() =>
                              !isDisabled && !loading &&
                              handleEmployeeToggle(index, employee._id)
                            }
                          >
                            <span>{employee.name}</span>
                            <span style={styles.checkmark}>
                              {isSelected ? "✓" : ""}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Notes Section */}
            <div style={styles.section}>
              <label style={styles.label}>Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special instructions or requirements..."
                maxLength={300}
                rows={3}
                style={styles.textarea}
                disabled={loading}
              />
              <div style={styles.charCount}>
                <small>{notes.length}/300</small>
              </div>
            </div>
          </form>
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <button
            type="button"
            onClick={handleClose}
            style={styles.cancelBtn}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            style={{
              ...styles.createBtn,
              ...(loading ? styles.btnDisabled : {}),
            }}
            disabled={loading || timeslots.length === 0}
          >
            {loading ? "Creating..." : "Create Workday"}
          </button>
        </div>
      </div>
    </div>
  );
};

// Inline styles for guaranteed scrolling functionality
const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },
  modal: {
    backgroundColor: "white",
    borderRadius: "12px",
    width: "100%",
    maxWidth: "500px",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
  },
  header: {
    padding: "20px",
    borderBottom: "1px solid #e0e0e0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "600",
    color: "#333",
  },
  subtitle: {
    margin: "4px 0 0 0",
    fontSize: "14px",
    color: "#666",
  },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: "20px",
    cursor: "pointer",
    padding: "8px",
    color: "#666",
    borderRadius: "4px",
  },
  content: {
    flex: 1,
    overflow: "auto",
    padding: "20px",
    minHeight: 0, // Critical for flex scrolling
  },
  section: {
    marginBottom: "24px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: "600",
    color: "#333",
  },
  addBtn: {
    backgroundColor: "#007AFF",
    color: "white",
    border: "none",
    padding: "8px 16px",
    borderRadius: "8px",
    fontSize: "14px",
    cursor: "pointer",
  },
  timeslot: {
    backgroundColor: "#f8f9fa",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "16px",
  },
  timeslotHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "16px",
  },
  slotNumber: {
    backgroundColor: "#007AFF",
    color: "white",
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: "600",
  },
  timePreview: {
    color: "#007AFF",
    fontWeight: "500",
    fontSize: "14px",
  },
  removeBtn: {
    background: "none",
    border: "none",
    color: "#ff3b30",
    cursor: "pointer",
    padding: "4px",
    borderRadius: "4px",
    fontSize: "16px",
  },
  inputRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr auto",
    gap: "12px",
    marginBottom: "16px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
  },
  label: {
    fontSize: "12px",
    fontWeight: "500",
    color: "#666",
    marginBottom: "4px",
  },
  input: {
    padding: "12px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    fontSize: "16px",
  },
  employeeSection: {
    marginTop: "16px",
  },
  employeeList: {
    border: "1px solid #ddd",
    borderRadius: "8px",
    maxHeight: "150px",
    overflow: "auto",
  },
  employeeOption: {
    padding: "12px",
    borderBottom: "1px solid #f0f0f0",
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  employeeSelected: {
    backgroundColor: "#007AFF",
    color: "white",
  },
  employeeDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  checkmark: {
    fontWeight: "bold",
  },
  textarea: {
    width: "100%",
    padding: "12px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    fontSize: "16px",
    resize: "vertical",
    minHeight: "80px",
    fontFamily: "inherit",
  },
  charCount: {
    textAlign: "right",
    marginTop: "4px",
    color: "#666",
  },
  actions: {
    padding: "20px",
    borderTop: "1px solid #e0e0e0",
    display: "flex",
    gap: "12px",
    flexShrink: 0,
  },
  cancelBtn: {
    flex: 1,
    padding: "12px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    backgroundColor: "white",
    color: "#333",
    fontSize: "16px",
    cursor: "pointer",
  },
  createBtn: {
    flex: 1,
    padding: "12px",
    border: "none",
    borderRadius: "8px",
    backgroundColor: "#007AFF",
    color: "white",
    fontSize: "16px",
    cursor: "pointer",
    fontWeight: "600",
  },
  btnDisabled: {
    backgroundColor: "#ccc",
    cursor: "not-allowed",
  },
};

// Mobile responsive adjustments
if (typeof window !== 'undefined' && window.innerWidth <= 768) {
  styles.overlay.padding = "0";
  styles.modal.borderRadius = "0";
  styles.modal.maxHeight = "100vh";
  styles.modal.height = "100vh";
  styles.inputRow.gridTemplateColumns = "1fr";
}

export default CreateWorkdayModal;
