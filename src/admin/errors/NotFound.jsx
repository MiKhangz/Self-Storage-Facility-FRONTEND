export default function NotFound({ pageName }) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '70vh',
            textAlign: 'center',
            fontFamily: 'sans-serif',
            color: '#495057'
        }}>
            <h1 style={{ fontSize: '72px', margin: '0 0 10px 0', color: '#adb5bd' }}>404</h1>
            <h2 style={{ fontSize: '22px', margin: '0 0 14px 0', color: '#0b2545' }}>
                {pageName || "Page"} Not Found
            </h2>
            <p style={{ maxWidth: '400px', margin: '0', color: '#868e96', fontSize: '14px', lineHeight: '1.5' }}>
                The workspace module you clicked is currently under development. Use the navigation sidebar to jump back to Facilities or Dashboard views.
            </p>
        </div>
    );
}
