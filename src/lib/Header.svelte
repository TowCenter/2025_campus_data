<script>
    // Import the CJR styles
    import './cjr.css';
    
    // Logo configuration - update these URLs to change the logo
    const logoDesktopUrl = 'https://miro.medium.com/v2/resize:fit:1070/1*Bdt1nEsNDbLfk-w0b3dnqA.jpeg';
    const logoMobileUrl = 'https://miro.medium.com/v2/resize:fit:1070/1*Bdt1nEsNDbLfk-w0b3dnqA.jpeg';
    const logoAlt = 'Columbia Journalism School and Tow Center for Digital Journalism';
    const logoLink = 'https://towcenter.columbia.edu/';
</script>


<div class="container-fluid top-nav-box">
    <div class="container-lg top-nav-1">
        <header class="cjr-header">
            <a class="cjr-header__logo-link" href={logoLink} rel="home">
                <img
                    src={logoDesktopUrl}
                    alt={logoAlt}
                    class="cjr-header__logo"
                />
                <img
                    src={logoMobileUrl}
                    alt={logoAlt}
                    class="cjr-logo-mobile"
                />
            </a>
        </header>
    </div>
</div>
<style>
    .cjr-header__logo-link {
        display: flex;
        align-items: center;
        text-decoration: none;
        line-height: 0;
        width: auto;
        height: 100%;
    }
    
    .cjr-header__logo-link img.cjr-header__logo {
        max-width: 500px;
        width: auto !important;
        height: auto;
        max-height: 70px;
        object-fit: contain;
        display: block;
    }
    
    .cjr-header__logo-link img.cjr-logo-mobile {
        max-width: 100%;
        width: auto !important;
        height: auto;
        object-fit: contain;
        display: none;
    }
    
    @media screen and (max-width: 768px) {
        .cjr-header__logo-link img.cjr-header__logo {
            display: none;
        }
        
        .cjr-header__logo-link img.cjr-logo-mobile {
            display: block !important;
            max-height: 60px;
            width: auto !important;
            max-width: 100%;
        }
    }
</style>    
