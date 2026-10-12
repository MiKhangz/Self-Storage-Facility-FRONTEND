import './DashboardContent.css';

export default function DashboardContent() {
    return (
        <div className="dashboard-grid-view">
            <div className="dashboard-greeting-bar">
                <h2>Good morning, Nam</h2>
                <p>Monday 21/09/2026 · All facilities</p>
            </div>

            {/* CARD METRIC STRIP */}
            <div className="metrics-strip">
                <div className="metric-box">
                    <span className="box-title">Occupancy rate</span>
                    <h3>82.4%</h3>
                    <small className="trend-pos">+3.1% vs last month</small>
                </div>
                <div className="metric-box">
                    <span className="box-title">Revenue (Sep)</span>
                    <h3>1.24B ₫</h3>
                    <small className="trend-pos">+8.6% vs last month</small>
                </div>
                <div className="metric-box">
                    <span className="box-title">Active contracts</span>
                    <h3>612</h3>
                    <small className="trend-pos">+24 vs last month</small>
                </div>
                <div className="metric-box alert-card">
                    <span className="box-title">Overdue payments</span>
                    <h3 className="text-danger">18</h3>
                    <small className="text-danger">+4 vs last month</small>
                </div>
            </div>

            {/* SPLIT LAYOUT COLUMNS */}
            <div className="dashboard-row-split">
                {/* Left Side Layout Module */}
                <div className="split-column main-panel">
                    <div className="chart-placeholder-mock">
                        <h4>Monthly revenue trends</h4>
                        <div className="mock-graph">[ Simulated Bar Chart Visualization ]</div>
                    </div>
                </div>

                {/* Right Side Layout Module */}
                <div className="split-column sidebar-panel">
                    <div className="attention-box-wrapper">
                        <h4>Needs attention</h4>
                        <div className="attention-item alert">
                            <span>⚠️ 18 contracts overdue</span>
                            <small>Access auto-suspended for 3</small>
                        </div>
                        <div className="attention-item warning">
                            <span>📅 12 reservations to assign</span>
                            <small>Oldest waiting 2 hours</small>
                        </div>
                        <div className="attention-item info">
                            <span>💬 4 urgent support tickets</span>
                            <small>Customer locked out (S-118)</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
